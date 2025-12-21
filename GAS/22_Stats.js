// 22_Stats.gs

function normPlayerId_(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';

  const m = s.match(/(\d+)/);
  if (!m) return s;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return s;

  return String(n).padStart(3, '0');
}

function lookupValueByPlayerSeason_(sheetName, playerId, season, valueColKeys) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return undefined;

  const hmap = getHeaderMap_(sh);
  const colPid = pickCol_(hmap, ['playerid']) || 1;

  const targetPid = normPlayerId_(playerId);
  const targetSeason = Number(season);

  // 値列（通常：rate/rpoint列）
  let colValue = 0;
  for (const k of valueColKeys) {
    const key = String(k ?? '').trim();
    const lk = key.toLowerCase();
    if (hmap[lk]) { colValue = hmap[lk]; break; }
    if (hmap[key]) { colValue = hmap[key]; break; }
  }

  // 追加：season5 みたいな「季節列」方式にも対応
  if (!colValue && Number.isFinite(targetSeason)) {
    const seasonKey = `season${targetSeason}`; // headerMap は lower 済み
    if (hmap[seasonKey]) colValue = hmap[seasonKey];
    if (!colValue && hmap[`s${targetSeason}`]) colValue = hmap[`s${targetSeason}`];
  }

  if (!colValue) return undefined;

  const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  let found;
  for (const row of rows) {
    const pid = normPlayerId_(row[colPid - 1]);
    if (!pid || pid !== targetPid) continue;
    found = row[colValue - 1]; // 最後に見つかったものを採用
  }

  return toNum_(found) ?? found;
}

function getRateAndRPoint_(playerId) {
  const seasonInfo = getCurrentSeasonInfo_();
  const season = seasonInfo.season;

  const rate = lookupValueByPlayerSeason_(RATE_SHEET, playerId, season, ['rate', 'rating', 'レート']);
  const rPoint = lookupValueByPlayerSeason_(RPOINT_SHEET, playerId, season, ['rpoint', 'rポイント', 'Rポイント', 'ポイント']);

  return { season, rate, rPoint };
}
