import { randomInt, randomUUID } from 'crypto';
import { Router } from 'express';
import { pool, query } from '../database';
import { AuthRequest, requireAuth, requirePermission } from '../middleware/auth';
import { notifyUsers } from '../services/push';

const router=Router();
const ACTIVE=['searching','offered','accepted','driver_en_route','driver_arrived','ready_to_start','in_progress','driver_completed'];
const CHAT_OPEN=['accepted','driver_en_route','driver_arrived','ready_to_start','in_progress','driver_completed'];

async function participant(rideId:string,userId:string){
  const result=await query<any>('SELECT * FROM rides WHERE id=$1 AND (passenger_id=$2 OR zem_id=$2) LIMIT 1',[rideId,userId]);
  return result.rows[0]||null;
}

async function nextOffer(client:any,ride:any,excluded:string[]=[]){
  const candidate=await client.query(`SELECT zl.zem_id,ROUND(ST_Distance(zl.location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric/1000,2) dist_km
    FROM zem_locations zl JOIN user_roles ur ON ur.user_id=zl.zem_id AND ur.role_key='zem_driver'
    WHERE zl.is_online=true AND ST_DWithin(zl.location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,5000)
      AND NOT(zl.zem_id=ANY($3::varchar[]))
      AND NOT EXISTS(SELECT 1 FROM rides busy WHERE busy.zem_id=zl.zem_id AND busy.status=ANY($4::text[]))
    ORDER BY dist_km LIMIT 1`,[ride.origin_lng,ride.origin_lat,excluded,ACTIVE]);
  if(!candidate.rows[0]){
    await client.query(`UPDATE rides SET status='expired',updated_at=now(),version=version+1 WHERE id=$1`,[ride.id]);
    await client.query(`INSERT INTO ride_events(ride_id,event_type,from_status,to_status,metadata) VALUES($1,'search_exhausted',$2,'expired','{}')`,[ride.id,ride.status]);
    return null;
  }
  const sequence=(await client.query('SELECT COALESCE(MAX(sequence),0)+1 next FROM ride_offers WHERE ride_id=$1',[ride.id])).rows[0].next;
  const offer=(await client.query(`INSERT INTO ride_offers(ride_id,zem_id,sequence,distance_km,expires_at)
    VALUES($1,$2,$3,$4,now()+interval '45 seconds') RETURNING *`,[ride.id,candidate.rows[0].zem_id,sequence,candidate.rows[0].dist_km])).rows[0];
  await client.query(`UPDATE rides SET zem_id=$1,status='offered',offered_at=now(),updated_at=now(),version=version+1 WHERE id=$2`,[offer.zem_id,ride.id]);
  await client.query(`INSERT INTO ride_events(ride_id,event_type,from_status,to_status,metadata) VALUES($1,'offer_created',$2,'offered',$3)`,[ride.id,ride.status,{offer_id:offer.id,zem_id:offer.zem_id}]);
  return offer;
}

async function advanceExpiredOffer(rideId:string){
  if(!pool)return;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ride=(await client.query<any>('SELECT * FROM rides WHERE id=$1 FOR UPDATE',[rideId])).rows[0];
    if(!ride||ride.status!=='offered'){await client.query('ROLLBACK');return;}
    const expired=(await client.query<any>(`UPDATE ride_offers SET status='expired',responded_at=now() WHERE ride_id=$1 AND status='offered' AND expires_at<=now() RETURNING id`,[rideId])).rows;
    if(!expired.length){await client.query('ROLLBACK');return;}
    const excluded=(await client.query<{zem_id:string}>('SELECT zem_id FROM ride_offers WHERE ride_id=$1',[rideId])).rows.map((row:any)=>row.zem_id);
    const offer=await nextOffer(client,{...ride,status:'offered'},excluded);
    await client.query('COMMIT');
    if(offer)void notifyUsers([offer.zem_id],'Nouvelle course LOTISEC',`${Number(ride.distance_km).toFixed(1)} km · ${ride.price_fcfa} FCFA`,{type:'ride_offer',ride_id:ride.id,offer_id:offer.id});
  }catch(error){await client.query('ROLLBACK');console.error('offer advance failed',error);}finally{client.release();}
}

router.post('/request',requireAuth,async(req:AuthRequest,res)=>{
  const {originLat,originLng,destLat,destLng,distanceKm,priceFcfa}=req.body;
  if(![originLat,originLng,destLat,destLng,distanceKm,priceFcfa].every(Number.isFinite))return res.status(400).json({detail:'Coordonnées, distance et prix valides requis'});
  if(!pool)return res.status(503).json({detail:'Base indisponible'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const existing=await client.query<any>('SELECT * FROM rides WHERE passenger_id=$1 AND status=ANY($2::text[]) FOR UPDATE',[req.userId,ACTIVE]);
    if(existing.rows[0]){await client.query('ROLLBACK');return res.status(409).json({detail:'Une course est déjà active',ride:existing.rows[0]});}
    const ride=(await client.query<any>(`INSERT INTO rides(passenger_id,origin_lat,origin_lng,dest_lat,dest_lng,distance_km,price_fcfa,status,pickup_code)
      VALUES($1,$2,$3,$4,$5,$6,$7,'searching',$8) RETURNING *`,[req.userId,originLat,originLng,destLat,destLng,distanceKm,priceFcfa,String(randomInt(1000,10000))])).rows[0];
    await client.query(`INSERT INTO ride_events(ride_id,actor_id,event_type,to_status) VALUES($1,$2,'ride_requested','searching')`,[ride.id,req.userId]);
    const offer=await nextOffer(client,ride);
    await client.query('COMMIT');
    if(!offer)return res.status(404).json({detail:'Aucun Zem disponible dans un rayon de 5 km',ride:{...ride,status:'expired'}});
    void notifyUsers([offer.zem_id],'Nouvelle course LOTISEC',`${Number(distanceKm).toFixed(1)} km · ${priceFcfa} FCFA`,{type:'ride_offer',ride_id:ride.id,offer_id:offer.id});
    return res.status(201).json({ride:{...ride,zem_id:offer.zem_id,status:'offered'},offer_expires_at:offer.expires_at,zem_distance:offer.distance_km});
  }catch(error:any){await client.query('ROLLBACK');console.error(error);return res.status(500).json({detail:'Création de course impossible'});}finally{client.release();}
});

router.post('/location',requireAuth,requirePermission('zem:drive'),async(req:AuthRequest,res)=>{
  const {lat,lng,isOnline}=req.body;
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return res.status(400).json({detail:'Coordonnées invalides'});
  const result=await query<any>(`INSERT INTO zem_locations(zem_id,latitude,longitude,is_online,location,updated_at) VALUES($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($3,$2),4326),now())
    ON CONFLICT(zem_id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,is_online=EXCLUDED.is_online,location=EXCLUDED.location,updated_at=now() RETURNING *`,[req.userId,lat,lng,Boolean(isOnline)]);
  const active=await query<any>('SELECT id FROM rides WHERE zem_id=$1 AND status=ANY($2::text[]) ORDER BY created_at DESC LIMIT 1',[req.userId,ACTIVE]);
  if(active.rows[0])await query(`INSERT INTO ride_positions(ride_id,user_id,latitude,longitude,accuracy,heading,speed) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE NOT EXISTS(SELECT 1 FROM ride_positions WHERE ride_id=$1 AND user_id=$2 AND created_at>now()-interval '5 seconds')`,[active.rows[0].id,req.userId,lat,lng,req.body.accuracy??null,req.body.heading??null,req.body.speed??null]);
  return res.json(result.rows[0]);
});

router.get('/offers/current',requireAuth,requirePermission('zem:drive'),async(req:AuthRequest,res)=>{
  const stale=await query<{ride_id:string}>(`SELECT DISTINCT ride_id FROM ride_offers WHERE zem_id=$1 AND status='offered' AND expires_at<=now()`,[req.userId]);
  for(const row of stale.rows)await advanceExpiredOffer(row.ride_id);
  const offers=await query<any>(`SELECT ro.*,r.origin_lat,r.origin_lng,r.dest_lat,r.dest_lng,r.distance_km,r.price_fcfa,r.passenger_id
    FROM ride_offers ro JOIN rides r ON r.id=ro.ride_id WHERE ro.zem_id=$1 AND ro.status='offered' AND ro.expires_at>now() ORDER BY ro.offered_at DESC`,[req.userId]);
  return res.json({offers:offers.rows});
});

router.post('/offers/:offerId/respond',requireAuth,requirePermission('zem:drive'),async(req:AuthRequest,res)=>{
  const decision=req.body?.decision||(req.body?.accept===true?'accept':req.body?.accept===false?'decline':'');
  const accept=decision==='accept'; if(!accept&&decision!=='decline')return res.status(400).json({detail:'Décision invalide'});
  if(!pool)return res.status(503).json({detail:'Base indisponible'}); const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const offer=(await client.query<any>('SELECT ro.*,r.status ride_status,r.passenger_id FROM ride_offers ro JOIN rides r ON r.id=ro.ride_id WHERE ro.id=$1 FOR UPDATE OF ro,r',[req.params.offerId])).rows[0];
    if(!offer||offer.zem_id!==req.userId){await client.query('ROLLBACK');return res.status(404).json({detail:'Offre introuvable'});}
    if(offer.status!=='offered'||new Date(offer.expires_at)<=new Date()){
      await client.query(`UPDATE ride_offers SET status='expired',responded_at=now() WHERE id=$1 AND status='offered'`,[offer.id]);await client.query('COMMIT');return res.status(409).json({detail:'Offre expirée'});
    }
    if(accept){
      const busy=await client.query('SELECT 1 FROM rides WHERE zem_id=$1 AND id<>$2 AND status=ANY($3::text[])',[req.userId,offer.ride_id,ACTIVE]);
      if(busy.rows[0]){await client.query('ROLLBACK');return res.status(409).json({detail:'Vous avez déjà une course active'});}
      await client.query(`UPDATE ride_offers SET status='accepted',responded_at=now() WHERE id=$1`,[offer.id]);
      const ride=(await client.query<any>(`UPDATE rides SET status='accepted',zem_id=$1,accepted_at=now(),updated_at=now(),version=version+1 WHERE id=$2 AND status='offered' RETURNING *`,[req.userId,offer.ride_id])).rows[0];
      if(!ride){await client.query('ROLLBACK');return res.status(409).json({detail:'Course déjà attribuée'});}
      await client.query(`UPDATE ride_offers SET status='canceled',responded_at=now() WHERE ride_id=$1 AND id<>$2 AND status='offered'`,[offer.ride_id,offer.id]);
      await client.query(`INSERT INTO ride_events(ride_id,actor_id,event_type,from_status,to_status) VALUES($1,$2,'offer_accepted','offered','accepted')`,[offer.ride_id,req.userId]);
      await client.query('COMMIT'); void notifyUsers([offer.passenger_id],'Zem trouvé','Votre conducteur a accepté la course.',{type:'ride_accepted',ride_id:offer.ride_id}); return res.json({ride});
    }
    await client.query(`UPDATE ride_offers SET status='declined',responded_at=now() WHERE id=$1`,[offer.id]);
    const ride=(await client.query<any>('SELECT * FROM rides WHERE id=$1',[offer.ride_id])).rows[0];
    const excluded=(await client.query<{zem_id:string}>('SELECT zem_id FROM ride_offers WHERE ride_id=$1',[ride.id])).rows.map((r:any)=>r.zem_id);
    const next=await nextOffer(client,{...ride,status:'offered'},excluded); await client.query('COMMIT');
    if(next)void notifyUsers([next.zem_id],'Nouvelle course LOTISEC',`${Number(ride.distance_km).toFixed(1)} km · ${ride.price_fcfa} FCFA`,{type:'ride_offer',ride_id:ride.id,offer_id:next.id});
    return res.json({status:next?'reassigned':'expired'});
  }catch(error:any){await client.query('ROLLBACK');console.error(error);return res.status(500).json({detail:'Réponse impossible'});}finally{client.release();}
});

router.get('/history',requireAuth,async(req:AuthRequest,res)=>{
  const page=Math.max(1,Number(req.query.page)||1),size=Math.min(50,Math.max(1,Number(req.query.page_size)||20));
  const rows=await query<any>(`SELECT r.*,(SELECT COUNT(*)::int FROM ride_messages m WHERE m.ride_id=r.id AND m.sender_id<>$1 AND m.read_at IS NULL) unread_messages FROM rides r WHERE passenger_id=$1 OR zem_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,[req.userId,size,(page-1)*size]);
  return res.json({rides:rows.rows,page,page_size:size});
});
router.get('/history/:ignored',requireAuth,async(req:AuthRequest,res)=>{
  const rows=await query<any>('SELECT * FROM rides WHERE passenger_id=$1 OR zem_id=$1 ORDER BY created_at DESC LIMIT 100',[req.userId]);return res.json({rides:rows.rows});
});
router.get('/rides/:rideId',requireAuth,async(req:AuthRequest,res)=>{let ride=await participant(req.params.rideId,req.userId as string);if(!ride)return res.status(404).json({detail:'Course introuvable'});if(ride.status==='offered'){await advanceExpiredOffer(ride.id);ride=await participant(req.params.rideId,req.userId as string);}return res.json({ride});});

router.post('/rides/:rideId/action',requireAuth,async(req:AuthRequest,res)=>{
  if(!pool)return res.status(503).json({detail:'Base indisponible'});const client=await pool.connect();let other:string|null=null,nextStatus='';let result:any;
  try{await client.query('BEGIN');const ride=(await client.query<any>('SELECT * FROM rides WHERE id=$1 AND (passenger_id=$2 OR zem_id=$2) FOR UPDATE',[req.params.rideId,req.userId])).rows[0];if(!ride){await client.query('ROLLBACK');return res.status(404).json({detail:'Course introuvable'});}
    const driver=ride.zem_id===req.userId,passenger=ride.passenger_id===req.userId,action=String(req.body?.action||'');const cancelable=['searching','offered','accepted','driver_en_route','driver_arrived','ready_to_start','in_progress'];const rules:any={driver_en_route:[driver,'accepted','driver_en_route','driver_en_route_at'],driver_arrived:[driver,'driver_en_route','driver_arrived','driver_arrived_at'],passenger_ready:[passenger,'driver_arrived','ready_to_start','passenger_ready_at'],start:[driver,'ready_to_start','in_progress','started_at'],driver_completed:[driver,'in_progress','driver_completed','driver_completed_at'],confirm_complete:[passenger,'driver_completed','completed','passenger_completed_at'],cancel:[(passenger||driver)&&cancelable.includes(ride.status),ride.status,'canceled','canceled_at'],no_show:[driver,'driver_arrived','no_show','canceled_at'],dispute:[passenger||driver,'driver_completed','disputed',null]};const rule=rules[action];if(!rule||!rule[0]){await client.query('ROLLBACK');return res.status(403).json({detail:'Action interdite'});}if(ride.status!==rule[1]){await client.query('ROLLBACK');return res.status(409).json({detail:`Action ${action} impossible depuis ${ride.status}`});}
    const timestamp=rule[3]?`,${rule[3]}=now()`:'';const completion=rule[2]==='completed'?',completed_at=now()':'';result=(await client.query<any>(`UPDATE rides SET status=$1,updated_at=now(),version=version+1${timestamp}${completion} WHERE id=$2 RETURNING *`,[rule[2],ride.id])).rows[0];await client.query(`INSERT INTO ride_events(ride_id,actor_id,event_type,from_status,to_status,metadata) VALUES($1,$2,$3,$4,$5,$6)`,[ride.id,req.userId,action,ride.status,rule[2],{reason:req.body?.reason||null}]);await client.query('COMMIT');other=driver?ride.passenger_id:ride.zem_id;nextStatus=rule[2];
  }catch(error){await client.query('ROLLBACK');console.error(error);return res.status(500).json({detail:'Transition impossible'});}finally{client.release();}
  if(other)void notifyUsers([other],'Mise à jour de votre course',nextStatus.replace(/_/g,' '),{type:'ride_status',ride_id:req.params.rideId,status:nextStatus});return res.json({ride:result});
});

router.get('/rides/:rideId/messages',requireAuth,async(req:AuthRequest,res)=>{
  const ride=await participant(req.params.rideId,req.userId as string);if(!ride)return res.status(404).json({detail:'Course introuvable'});
  const before=req.query.before?new Date(String(req.query.before)):null;
  const rows=await query<any>(`SELECT id,ride_id,sender_id,body,client_message_id,created_at,read_at FROM ride_messages WHERE ride_id=$1 AND ($2::timestamptz IS NULL OR created_at<$2) ORDER BY created_at DESC LIMIT 50`,[ride.id,before]);
  return res.json({messages:rows.rows.reverse(),has_more:rows.rows.length===50,chat_open:CHAT_OPEN.includes(ride.status),ride_status:ride.status});
});
router.post('/rides/:rideId/messages',requireAuth,async(req:AuthRequest,res)=>{
  const ride=await participant(req.params.rideId,req.userId as string);if(!ride)return res.status(404).json({detail:'Course introuvable'});if(!CHAT_OPEN.includes(ride.status))return res.status(409).json({detail:'Conversation en lecture seule'});
  const body=String(req.body?.body||'').trim(),clientId=String(req.body?.client_message_id||randomUUID());if(!body||body.length>1000)return res.status(400).json({detail:'Message invalide'});
  const recent=await query<{count:number}>(`SELECT COUNT(*)::int count FROM ride_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute'`,[req.userId]);if((recent.rows[0]?.count||0)>=30)return res.status(429).json({detail:'Trop de messages, patientez un instant'});
  const message=await query<any>(`INSERT INTO ride_messages(ride_id,sender_id,body,client_message_id) VALUES($1,$2,$3,$4) ON CONFLICT(sender_id,client_message_id) DO UPDATE SET body=EXCLUDED.body RETURNING *`,[ride.id,req.userId,body,clientId]);
  const other=ride.passenger_id===req.userId?ride.zem_id:ride.passenger_id;if(other)void notifyUsers([other],'Nouveau message de course',body.slice(0,100),{type:'ride_message',ride_id:ride.id});return res.status(201).json({message:message.rows[0]});
});
router.patch('/rides/:rideId/messages/read',requireAuth,async(req:AuthRequest,res)=>{const ride=await participant(req.params.rideId,req.userId as string);if(!ride)return res.status(404).json({detail:'Course introuvable'});await query('UPDATE ride_messages SET read_at=now() WHERE ride_id=$1 AND sender_id<>$2 AND read_at IS NULL',[ride.id,req.userId]);return res.json({ok:true});});
router.get('/rides/:rideId/positions/latest',requireAuth,async(req:AuthRequest,res)=>{const ride=await participant(req.params.rideId,req.userId as string);if(!ride)return res.status(404).json({detail:'Course introuvable'});const row=await query<any>('SELECT * FROM ride_positions WHERE ride_id=$1 ORDER BY created_at DESC LIMIT 1',[ride.id]);return res.json({position:row.rows[0]||null});});
router.post('/push-token',requireAuth,async(req:AuthRequest,res)=>{const token=String(req.body?.token||'');if(!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token))return res.status(400).json({detail:'Jeton Expo invalide'});await query(`INSERT INTO device_push_tokens(user_id,expo_push_token,platform) VALUES($1,$2,$3) ON CONFLICT(expo_push_token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,active=true,updated_at=now()`,[req.userId,token,String(req.body?.platform||'unknown')]);return res.json({ok:true});});

export default router;
