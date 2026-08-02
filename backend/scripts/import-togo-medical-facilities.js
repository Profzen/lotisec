const {Pool}=require('pg');
require('dotenv').config();

const OVERPASS_URL=process.env.OVERPASS_URL||'https://overpass-api.de/api/interpreter';
const query=`[out:json][timeout:90];area["ISO3166-1"="TG"][admin_level=2]->.togo;(nwr["amenity"="hospital"](area.togo);nwr["amenity"="clinic"](area.togo);nwr["amenity"="doctors"](area.togo);nwr["healthcare"="hospital"](area.togo);nwr["healthcare"="clinic"](area.togo);nwr["healthcare"="health_centre"](area.togo););out center tags;`;
const value=(tags,...keys)=>keys.map(key=>tags[key]).find(Boolean)||null;
const category=tags=>tags.amenity==='hospital'||tags.healthcare==='hospital'?'hopital':tags.amenity==='clinic'||tags.healthcare==='clinic'?'clinique':tags.healthcare==='health_centre'?'cs':'dispensaire';

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL manquante');
  const response=await fetch(OVERPASS_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LOTISEC/1.0 (contact: repository Profzen/lotisec)'},body:new URLSearchParams({data:query})});
  if(!response.ok)throw new Error(`Overpass HTTP ${response.status}`);
  const payload=await response.json();const facilities=payload.elements.map(element=>({element,tags:element.tags||{},lat:element.lat??element.center?.lat,lng:element.lon??element.center?.lon})).filter(item=>item.lat&&item.lng&&value(item.tags,'name','official_name'));
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});const client=await pool.connect();
  try{await client.query('BEGIN');for(const item of facilities){const t=item.tags;const address=value(t,'addr:full')||[value(t,'addr:street'),value(t,'addr:city','addr:place')].filter(Boolean).join(', ')||'Togo';const phone=value(t,'contact:phone','phone');const emergency=t.emergency==='yes'||t['healthcare:speciality']?.includes('emergency');await client.query(`INSERT INTO medical_facilities(name,type,address,phone,urgences,latitude,longitude,location,source,source_id,last_verified_at,verified,services,opening_hours,emergency_level,active) VALUES($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($7,$6),4326),$8,$9,now(),false,$10,$11,$12,true) ON CONFLICT(source,source_id) WHERE source_id IS NOT NULL DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,address=EXCLUDED.address,phone=EXCLUDED.phone,urgences=EXCLUDED.urgences,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,location=EXCLUDED.location,last_verified_at=now(),services=EXCLUDED.services,opening_hours=EXCLUDED.opening_hours,emergency_level=EXCLUDED.emergency_level,active=true`,[value(t,'name','official_name'),category(t),address,phone,emergency,item.lat,item.lng,'OpenStreetMap',`${item.element.type}/${item.element.id}`,value(t,'healthcare:speciality')?.split(';')||[],value(t,'opening_hours'),emergency?'emergency':null]);}await client.query('COMMIT');console.log(`${facilities.length} établissements OSM importés ou actualisés.`);}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
}
main().catch(error=>{console.error(error.message);process.exit(1);});
