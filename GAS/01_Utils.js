// 01_Utils.gs
function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Sheet not found: ${name}`);
  return sh;
}

function parseBody_(e) {
  const raw = String(e?.postData?.contents || '').trim();

  if (raw) {
    try { return JSON.parse(raw); } catch (_) {}
  }

  // フォールバック：フォーム送信やExecution APIっぽい形
  const p = e?.parameter || {};
  // token はクエリ側で見る運用なので、bodyには入れなくてOK
  return { ...p };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function toIso_(v) {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : '';
}

function toNum_(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeItems_(items) {
  const arr = Array.isArray(items) ? items : [];
  return Array.from({ length: 20 }, (_, i) => {
    const v = arr[i];
    return v === undefined || v === null ? '' : String(v);
  });
}

function getHeaderMap_(sh) {
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(x => String(x ?? '').trim().toLowerCase());
  const map = {};
  header.forEach((h, i) => { if (h) map[h] = i + 1; }); // 1-based
  return map;
}

function pickCol_(map, keys) {
  for (const k of keys) if (map[k]) return map[k];
  return 0;
}

function normBoolActive_(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === '') return true; // 空ならとりあえずActive扱い（運用に合わせて変えてOK）
  return ['active', '1', 'true', 'on', 'yes', '有効'].includes(s);
}
