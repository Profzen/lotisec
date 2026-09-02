import { strToU8, zipSync } from 'fflate'

const xml=value=>String(value??'').replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
}[character]))

const cell=(value,style=0)=>({value,style})
const formula=(expression,value,style=0)=>({formula:expression,value,style})
const row=(values,style=0,height=null)=>({cells:values.map(value=>typeof value==='object'&&value&&('value'in value||'formula'in value)?value:cell(value,style)),height})

function columnName(index){
  let value=index+1,result=''
  while(value){value-=1;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26)}
  return result
}

function cellXml(item,address){
  const style=item?.style?` s="${item.style}"`:''
  if(item?.formula){
    const cached=Number.isFinite(Number(item.value))?Number(item.value):0
    return `<c r="${address}"${style}><f>${xml(item.formula)}</f><v>${cached}</v></c>`
  }
  const value=item?.value
  if(typeof value==='number'&&Number.isFinite(value)) return `<c r="${address}"${style}><v>${value}</v></c>`
  if(typeof value==='boolean') return `<c r="${address}" t="b"${style}><v>${value?1:0}</v></c>`
  return `<c r="${address}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function worksheetXml(sheet){
  const maxColumns=Math.max(1,...sheet.rows.map(item=>item.cells.length))
  const maxRows=Math.max(1,sheet.rows.length)
  const rows=sheet.rows.map((item,rowIndex)=>{
    const number=rowIndex+1
    const height=item.height?` ht="${item.height}" customHeight="1"`:''
    const cells=item.cells.map((entry,columnIndex)=>cellXml(entry,`${columnName(columnIndex)}${number}`)).join('')
    return `<row r="${number}"${height}>${cells}</row>`
  }).join('')
  const widths=(sheet.widths||Array(maxColumns).fill(16)).map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join('')
  const freeze=sheet.freezeRows?`<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows+1}" activePane="bottomLeft" state="frozen"/>`:''
  const filter=sheet.autoFilter?`<autoFilter ref="${sheet.autoFilter}"/>`:''
  const merges=sheet.merges?.length?`<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews><cols>${widths}</cols><sheetData>${rows}</sheetData>${filter}${merges}<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
}

const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="6"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FF991B1B"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FF047857"/><name val="Aptos"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF072B4D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="5" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function reportSheets({alerts=[],ambulances=[],hospitals=[],mission=null,missionReports=[],metrics=[],auditLog=[],fog={}}){
  const generatedAt=new Date()
  const activeAlerts=alerts.filter(item=>!['Clôturée','Rejetée'].includes(item.status))
  const available=ambulances.filter(item=>item.status==='Disponible').length
  const victims=alerts.reduce((sum,item)=>sum+(Number(item.victims)||0),0)
  const availableBeds=hospitals.reduce((sum,item)=>sum+(Number(item.beds)||0),0)
  const reports=missionReports.length?missionReports.map(item=>({
    ...item,
    alertId:item.alertId||item.incidentId||'—',
    hospitalName:item.hospitalName||item.hospitalId||'—',
    routeName:item.routeName||item.finalRoute||item.initialRoute||'—',
    distance:Number(item.actualDistance??item.distance??0),
    eta:Number(item.actualEta??item.eta??0),
    status:item.status||'Terminée',
    reroutes:Number(item.rerouteCount??item.reroutes??0),
    startedAt:item.startedAt||item.createdAt,
  })):mission?[{
    id:mission.id,alertId:mission.alertId,ambulanceId:mission.ambulanceId,hospitalName:hospitals.find(item=>item.id===(mission.hospitalId||mission.recommendedHospitalId))?.name||'—',
    routeName:mission.ambulanceRouteMeta?.name||mission.routeMeta?.name||'—',distance:mission.ambulanceRouteMeta?.distance||mission.routeMeta?.distance||0,eta:mission.ambulanceRouteMeta?.eta||mission.routeMeta?.eta||0,status:mission.status,reroutes:mission.rerouteCount||0,startedAt:mission.createdAt||mission.startedAt,completedAt:null,
  }]:[]
  const summaryRows=[
    row(['RAPPORT OPÉRATIONNEL LOTISEC','','',''],1,30),
    row([`Généré le ${generatedAt.toLocaleString('fr-FR')} · Données de la session courante`,'','',''],2,24),
    row(['INDICATEURS CLÉS','','',''],3,22),
    row(['Indicateur','Valeur','Unité','Lecture'],4,22),
    row(['Incidents enregistrés',formula("COUNTA('Incidents'!A2:A1001)",alerts.length),'incident(s)','Tous les signalements chargés']),
    row(['Alertes actives',formula("COUNTIFS('Incidents'!F2:F1001,\"<>Clôturée\",'Incidents'!F2:F1001,\"<>Rejetée\")",activeAlerts.length),'alerte(s)','À traiter ou en cours']),
    row(['Victimes signalées',formula("SUM('Incidents'!E2:E1001)",victims),'personne(s)','Donnée déclarative du signalement']),
    row(['Ambulances disponibles',formula("COUNTIF('Ambulances'!C2:C1001,\"Disponible\")",available),'unité(s)',`${ambulances.length} ambulance(s) suivie(s)`]),
    row(['Disponibilité des ambulances',cell(ambulances.length?available/ambulances.length:0,8),'taux','Rapport unités disponibles / flotte']),
    row(['Places d’accueil disponibles',formula("SUM('Centres de santé'!E2:E1001)",availableBeds),'place(s)',`${hospitals.length} centre(s) suivi(s)`]),
    row(['Missions terminées',formula("COUNTIF('Missions'!H2:H1001,\"Terminée\")",reports.filter(item=>item.status==='Terminée').length),'mission(s)','Résumés finalisés']),
    row(['Mesures du prototype',formula("COUNTA('Mesures du prototype'!A2:A1001)",metrics.length),'trace(s)','Temps produits pendant la session']),
    row(['PÉRIMÈTRE SCIENTIFIQUE','','',''],3,22),
    row(['Nature des résultats','Validation fonctionnelle du prototype logiciel','',''],2,30),
    row(['Fog Computing','Mécanismes locaux simulés ; aucun nœud Fog physique déployé','',''],2,32),
    row(['Confidentialité','Rapport opérationnel : ne pas ajouter de données nominatives de victimes','',''],2,32),
  ]
  const incidentRows=alerts.map(item=>row([item.id,item.type,item.severity,item.location,Number(item.victims)||0,item.status||'Reçu',item.source||'—',item.receivedAt||item.received||'—',Number(item.lat)||0,Number(item.lng)||0],item.severity==='Critique'?5:0))
  const missionRows=reports.map(item=>row([item.id||item.missionId,item.alertId,item.ambulanceId,item.hospitalName||'—',item.routeName||'—',Number(item.distance)||0,Number(item.eta)||0,item.status||'—',Number(item.reroutes)||0,item.startedAt?new Date(item.startedAt).toISOString():'—',item.completedAt?new Date(item.completedAt).toISOString():'—'],item.status==='Terminée'?6:0))
  const sheets=[
    {name:'Synthèse',rows:summaryRows,widths:[34,30,18,48],merges:['A1:D1','A2:D2','A3:D3','A13:D13','B14:D14','B15:D15','B16:D16'],freezeRows:4,autoFilter:'A4:D12'},
    {name:'Incidents',rows:[row(['ID incident','Type d’urgence','Gravité','Localisation','Victimes','Statut','Source','Réception','Latitude','Longitude'],4,28),...incidentRows],widths:[20,28,14,38,12,22,28,24,14,14],freezeRows:1,autoFilter:`A1:J${Math.max(2,incidentRows.length+1)}`},
    {name:'Missions',rows:[row(['ID mission','ID incident','Ambulance','Hôpital recommandé','Itinéraire recommandé','Distance (km)','ETA (min)','Statut','Reroutages','Début','Fin'],4,28),...missionRows],widths:[24,20,14,28,46,15,13,24,13,24,24],freezeRows:1,autoFilter:`A1:K${Math.max(2,missionRows.length+1)}`},
    {name:'Ambulances',rows:[row(['ID ambulance','Service','Statut','Équipement','Équipe','Trafic','ETA (min)','Latitude','Longitude','Dernière mise à jour'],4,28),...ambulances.map(item=>row([item.id,item.provider,item.status,item.equipment,item.team,item.traffic,Number(item.eta)||0,Number(item.lat)||0,Number(item.lng)||0,item.updated||'—'],item.status==='Disponible'?6:0))],widths:[16,26,22,20,22,14,13,14,14,22],freezeRows:1,autoFilter:`A1:J${Math.max(2,ambulances.length+1)}`},
    {name:'Centres de santé',rows:[row(['ID centre','Nom','Spécialité','Statut connexion','Places disponibles','Occupation (%)','Réception','Services','Dernière actualisation'],4,28),...hospitals.map(item=>row([item.id,item.name,item.specialty,item.status,Number(item.beds)||0,Number(item.occupancy)||0,item.reception,(item.services||[]).join(', '),item.lastCapacityUpdate||'—'],item.beds>0?6:5))],widths:[15,30,28,19,18,16,16,42,24],freezeRows:1,autoFilter:`A1:I${Math.max(2,hospitals.length+1)}`},
    {name:'Mesures du prototype',rows:[row(['ID mesure','Heure','Indicateur','Valeur','Unité','Composant','Interprétation'],4,28),...metrics.map(item=>row([item.id,item.time,item.name,Number(item.value)||0,item.unit,item.source,item.detail]))],widths:[25,14,32,14,12,28,54],freezeRows:1,autoFilter:`A1:G${Math.max(2,metrics.length+1)}`},
    {name:'Journal Fog',rows:[row(['ID événement','Heure','Événement','Détail','Niveau'],4,28),...(fog.history||[]).map(item=>row([item.id,item.time,item.title,item.detail,item.tone],item.tone==='red'?5:item.tone==='green'?6:0))],widths:[27,14,34,62,14],freezeRows:1,autoFilter:`A1:E${Math.max(2,(fog.history||[]).length+1)}`},
    {name:'Journal opérationnel',rows:[row(['ID','Heure','Acteur','Catégorie','Action','Détail','Référence'],4,28),...auditLog.map(item=>row([item.id,item.time,item.actor,item.category,item.action,item.details,item.reference],item.tone==='red'?5:item.tone==='green'?6:0))],widths:[27,14,28,16,32,62,22],freezeRows:1,autoFilter:`A1:G${Math.max(2,auditLog.length+1)}`},
  ]
  return sheets
}

export function createLotisecWorkbookBytes(data={}){
  const sheets=reportSheets(data)
  const sheetOverrides={}
  sheets.forEach((sheet,index)=>{sheetOverrides[`xl/worksheets/sheet${index+1}.xml`]=strToU8(worksheetXml(sheet))})
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet,index)=>`<sheet name="${xml(sheet.name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  const timestamp=new Date().toISOString()
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Rapport opérationnel LOTISEC</dc:title><dc:creator>LOTISEC</dc:creator><cp:lastModifiedBy>LOTISEC</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>LOTISEC</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>LOTISEC</Company><AppVersion>1.0</AppVersion></Properties>`
  return zipSync({
    '[Content_Types].xml':strToU8(contentTypes),'_rels/.rels':strToU8(rootRels),'xl/workbook.xml':strToU8(workbook),'xl/_rels/workbook.xml.rels':strToU8(workbookRels),'xl/styles.xml':strToU8(stylesXml),'docProps/core.xml':strToU8(core),'docProps/app.xml':strToU8(app),...sheetOverrides,
  },{level:6})
}

export function downloadLotisecReport(data={}){
  const bytes=createLotisecWorkbookBytes(data)
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
  const link=document.createElement('a')
  const date=new Date().toISOString().slice(0,10)
  link.href=url;link.download=`rapport-lotisec-${date}.xlsx`;document.body.appendChild(link);link.click();link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
