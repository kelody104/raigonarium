// 21_Season.gs
function parseSeasonDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v ?? '').trim();
  if (!s) return null;

  const d = new Date(s); // "2026/1/1" など想定
  if (isNaN(d.getTime())) return null;
  return d;
}

function getCurrentSeasonInfo_() {
  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const todayYmd = Number(Utilities.formatDate(new Date(), tz, 'yyyyMMdd'));

  const sh = getSheet_(SEASONS_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('no seasons');

  const hmap = getHeaderMap_(sh);
  const colSeason = pickCol_(hmap, ['season']) || 1;
  const colStart  = pickCol_(hmap, ['seasonstart', 'start', 'seasonStart']) || 2;
  const colEnd    = pickCol_(hmap, ['seasonend', 'end', 'seasonEnd']) || 3;

  const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  let picked = null;
  let latestStartCandidate = null;
  let earliest = null;
  let latest = null;

  for (const row of rows) {
    const season = Number(row[colSeason - 1]);
    const start = parseSeasonDate_(row[colStart - 1]);
    const endRaw = parseSeasonDate_(row[colEnd - 1]);
    if (!Number.isFinite(season) || !start || !endRaw) continue;

    // end は当日終わりまで有効にする
    const end = new Date(endRaw.getTime());
    end.setHours(23, 59, 59, 999);

    const startYmd = Number(Utilities.formatDate(start, tz, 'yyyyMMdd'));
    const endYmd   = Number(Utilities.formatDate(end,   tz, 'yyyyMMdd'));

    const item = { season, start, end, startYmd, endYmd };

    if (!earliest || startYmd < earliest.startYmd) earliest = item;
    if (!latest   || endYmd   > latest.endYmd)     latest   = item;

    // 今日が範囲内なら確定
    if (todayYmd >= startYmd && todayYmd <= endYmd) {
      picked = item;
      break;
    }

    // 範囲外なら「開始日が今日以前の中で開始日が最も新しい」を候補に
    if (todayYmd >= startYmd) {
      if (!latestStartCandidate || startYmd > latestStartCandidate.startYmd) {
        latestStartCandidate = item;
      }
    }
  }

  if (!picked) picked = latestStartCandidate;

  // それも無い（今日が最初の開始日より前など）の保険
  if (!picked) {
    if (earliest && todayYmd < earliest.startYmd) picked = earliest;
    else if (latest) picked = latest;
  }

  if (!picked) throw new Error('season not found');

  return {
    season: picked.season,
    seasonStart: Utilities.formatDate(picked.start, tz, 'yyyy/M/d'),
    seasonEnd:   Utilities.formatDate(picked.end,   tz, 'yyyy/M/d'),
  };
}

function getCurrentSeason_() {
  return getCurrentSeasonInfo_().season;
}

// GET(action=season) 用
function getSeason_() {
  try {
    const info = getCurrentSeasonInfo_();
    // season だけ欲しいフロントにも、開始/終了日を使いたいフロントにも両対応
    return json_({
      ok: true,
      season: info.season,
      seasonStart: info.seasonStart,
      seasonEnd: info.seasonEnd,
    });
  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in getSeason',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}
