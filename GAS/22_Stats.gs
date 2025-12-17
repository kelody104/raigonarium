// 22_Stats.gs

function normPlayerId_(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';

  // "t001" みたいなのも来ても拾えるように数字だけ抜く
  const m = s.match(/(\d+)/);
  if (!m) return s;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return s;

  // 001 形式に寄せる（必要なければ padStart を外してOK）
  return String(n).padStart(3, '0');
}

function lookupValueByPlayerSeason_(sheetName, playerId, season, valueColKeys) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return undefined;

  const hmap = getHeaderMap_(sh);
  const colPid = pickCol_(hmap, ['playerid']) || 1;
  const colSeason = pickCol_(hmap, ['season']) || 0;

  // 値列（レート / Rポイント）
  let colValue = 0;
  for (const k of valueColKeys) {
    const key = String(k ?? '').trim(); // 日本語列名もあるので lower 強制しない
    const lk = key.toLowerCase();
    if (hmap[lk]) { colValue = hmap[lk]; break; }
    if (hmap[key]) { colValue = hmap[key]; break; }
  }
  if (!colValue) return undefined;

  const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  const targetPid = normPlayerId_(playerId);
  const targetSeason = Number(season);

  let found;
  for (const row of rows) {
    const pid = normPlayerId_(row[colPid - 1]);
    if (!pid || pid !== targetPid) continue;

    if (colSeason) {
      const s = Number(row[colSeason - 1]);
      if (Number.isFinite(targetSeason) && Number.isFinite(s) && s !== targetSeason) continue;
    }

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
