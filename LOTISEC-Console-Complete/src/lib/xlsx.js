import { strToU8, zipSync } from 'fflate'

const escapeXml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
const columnName=index=>{let result='';let value=index+1;while(value){value-=1;result=String.fromCharCode(65+(value%26))+result;value=Math.floor(value/26)}return result}
const safeSheetName=(name,index)=>String(name||`Feuille ${index+1}`).replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||`Feuille ${index+1}`

function cellXml(value,rowIndex,columnIndex,style=0){
  const reference=`${columnName(columnIndex)}${rowIndex+1}`
  if(value&&typeof value==='object'&&value.formula){return `<c r="${reference}"${style?` s="${style}"`:''}><f>${escapeXml(value.formula)}</f><v>${Number(value.value)||0}</v></c>`}
  if(typeof value==='number'&&Number.isFinite(value)) return `<c r="${reference}"${style?` s="${style}"`:''}><v>${value}</v></c>`
  if(typeof value==='boolean') return `<c r="${reference}" t="b"${style?` s="${style}"`:''}><v>${value?1:0}</v></c>`
  const text=String(value??'')
  return `<c r="${reference}" t="inlineStr"${style?` s="${style}"`:''}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

function worksheetXml(sheet){
  const rows=sheet.rows||[]
  const width=Math.max(1,...rows.map(row=>row.length))
  const headerRows=new Set(sheet.headerRows||[0])
  const titleRows=new Set(sheet.titleRows||[])
  const sheetRows=rows.map((row,rowIndex)=>{
    const style=titleRows.has(rowIndex)?2:headerRows.has(rowIndex)?1:0
    const cells=row.map((value,columnIndex)=>cellXml(value,rowIndex,columnIndex,style)).join('')
    return `<row r="${rowIndex+1}"${style===2?' ht="24" customHeight="1"':''}>${cells}</row>`
  }).join('')
  const cols=Array.from({length:width},(_,index)=>`<col min="${index+1}" max="${index+1}" width="${index===0?25:18}" customWidth="1"/>`).join('')
  const filter=sheet.autoFilter&&rows.length?`<autoFilter ref="A${sheet.autoFilter}:${columnName(width-1)}${rows.length}"/>`:''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows||1}" topLeftCell="A${(sheet.freezeRows||1)+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData>${filter}<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.2" footer="0.2"/></worksheet>`
}

const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF073B67"/><sz val="16"/><name val="Arial"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5CAD"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD8E1EB"/></left><right style="thin"><color rgb="FFD8E1EB"/></right><top style="thin"><color rgb="FFD8E1EB"/></top><bottom style="thin"><color rgb="FFD8E1EB"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function downloadXlsx(filename,sheets){
  const normalized=sheets.map((sheet,index)=>({...sheet,name:safeSheetName(sheet.name,index)}))
  const files={
    '[Content_Types].xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${normalized.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    'docProps/core.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Rapport opérationnel LOTISEC</dc:title><dc:creator>Plateforme LOTISEC</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    'docProps/app.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LOTISEC</Application><Company>LOTISEC</Company></Properties>`),
    'xl/workbook.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((sheet,index)=>`<sheet name="${escapeXml(sheet.name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}<Relationship Id="rId${normalized.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml':strToU8(stylesXml),
  }
  normalized.forEach((sheet,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=strToU8(worksheetXml(sheet))})
  const archive=zipSync(files,{level:6})
  const url=URL.createObjectURL(new Blob([archive],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
  const link=document.createElement('a');link.href=url;link.download=filename.endsWith('.xlsx')?filename:`${filename}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
