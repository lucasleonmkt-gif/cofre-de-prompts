// PromptVault — Google Apps Script Backend
// Si ya tenés una versión desplegada, reemplazá el código, guardá, y hacé
// Implementar → Administrar implementaciones → ✏️ editar → Nueva versión → Implementar

const SS_ID = '1U9b7KhR8BRLo4VwS6ZZZrgrPm4wJ33fXHYb6i2Dun3Y';

function doGet(e) {
  const ss = SpreadsheetApp.openById(SS_ID);

  if (e.parameter.action === 'save' && e.parameter.data) {
    const data = JSON.parse(decodeURIComponent(e.parameter.data));
    if (data.prompts !== undefined) writeSheet(ss, 'prompts', data.prompts, ['id','title','content','folderId','color','createdAt']);
    if (data.folders !== undefined) writeSheet(ss, 'folders', data.folders, ['id','name','parentId','createdAt']);
    const out = ContentService.createTextOutput(JSON.stringify({ ok: true }));
    out.setMimeType(ContentService.MimeType.JSON);
    return out;
  }

  const prompts = readSheet(ss, 'prompts');
  const folders = readSheet(ss, 'folders');
  const out = ContentService.createTextOutput(JSON.stringify({ prompts, folders }));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] === '' ? null : row[i]; });
    return obj;
  });
}

function writeSheet(ss, name, items, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  items.forEach(item => sheet.appendRow(headers.map(h => item[h] != null ? item[h] : '')));
}
