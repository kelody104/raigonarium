// 23_Progress.gs

const YAKU_SHEET_CANDIDATES = ['役管理', 'yaku', 'Yaku'];
const TITLE_SHEET_CANDIDATES = ['称号管理', 'title', 'Title', 'titles', 'Titles'];
const RESULT_SHEET_CANDIDATES = ['大会結果管理', 'tournamentResults', 'TournamentResults', 'results'];

// フォールバック用（Configで RATE_SHEET / RPOINT_SHEET が無い・違う場合に備える）
const RATE_SHEET_CANDIDATES = ['レート管理', 'rate', 'Rate', 'rating', 'Ratings'];
const RPOINT_SHEET_CANDIDATES = ['Rポイント管理', 'rポイント管理', 'rpoint', 'RPoint', 'Rポイント', 'points'];

function getProgress_(e) {
  try {
    const playerId = String(e?.parameter?.playerId ?? '').trim();
    if (!playerId) return json_({ ok: false, error: 'playerId is required' });

    const memberBase = getMemberInfoByPlayerId_(playerId);
    const stats = safeGetRateAndRPoint_(playerId); // season / rate / rPoint

    const member = memberBase
      ? { ...memberBase, ...stats }
      : {
        playerId: String(playerId),
        playerName: '',
        familyName: '',
        region: '',
        rank: '',
        status: '',
        ...stats,
      };

    const yaku = getWideCounts_(YAKU_SHEET_CANDIDATES, playerId, { kind: 'number' });
    const titles = getWideCounts_(TITLE_SHEET_CANDIDATES, playerId, { kind: 'bool' });
    const tournamentResults = getTournamentResultsByPlayer_(playerId);

    // ★追加：全シーズンRポイント / 全シーズンレート（seasonN列のワイド形式）
    const allSeasonRPoints = getAllSeasonSeries_(getRateOrRPointSheet_('rpoint'), playerId);
    const allSeasonRates = getAllSeasonSeries_(getRateOrRPointSheet_('rate'), playerId);

    return json_({
      ok: true,
      playerId: String(playerId),
      member,
      yaku: { headers: yaku.headers, counts: yaku.values },
      titles: { headers: titles.headers, flags: titles.values },
      tournamentResults,
      allSeasonRPoints,
      allSeasonRates,
    });

  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in getProgress',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}

// ---- member ----
function getMemberInfoByPlayerId_(playerId) {
  const sh = getSheet_(MEMBERS_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const hmap = getHeaderMap_(sh);
  const colPlayerId   = pickCol_(hmap, ['playerid'])   || 1;
  const colPlayerName = pickCol_(hmap, ['playername']) || 2;
  const colFamilyName = pickCol_(hmap, ['familyname']) || 4;
  const colRegion     = pickCol_(hmap, ['region'])     || 5;
  const colRank       = pickCol_(hmap, ['rank'])       || 6;
  const colRaijin     = pickCol_(hmap, ['raijin'])     || 0; // ★追加
  const colStatus     = pickCol_(hmap, ['status'])     || 7;

  const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const target = normPlayerId_(playerId);

  let hit = null;
  for (const r of rows) {
    if (normPlayerId_(r[colPlayerId - 1]) === target) hit = r;
  }
  if (!hit) return null;

  return {
    playerId: String(hit[colPlayerId - 1] ?? '').trim(),
    playerName: String(hit[colPlayerName - 1] ?? '').trim(),
    familyName: String(hit[colFamilyName - 1] ?? '').trim(),
    region: String(hit[colRegion - 1] ?? '').trim(),
    rank: String(hit[colRank - 1] ?? '').trim(),
    raijin: colRaijin ? String(hit[colRaijin - 1] ?? '').trim() : '', // ★追加
    status: String(hit[colStatus - 1] ?? '').trim(),
  };
}

// ---- stats (current season) ----
function safeGetRateAndRPoint_(playerId) {
  try {
    if (typeof getRateAndRPoint_ === 'function') return getRateAndRPoint_(playerId);
  } catch (_) { }
  return { season: null, rate: 0, rPoint: 0 };
}

// ---- wide sheets (役管理 / 称号管理) ----
function getWideCounts_(sheetCandidates, playerId, opt) {
  const sh = getOptionalSheetByCandidates_(sheetCandidates);
  if (!sh) return { headers: [], values: [] };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return { headers: [], values: [] };

  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => String(v ?? '').trim());

  const hmap = {};
  headerRow.map(h => h.toLowerCase()).forEach((h, i) => { if (h) hmap[h] = i + 1; });

  const colPid = hmap['playerid'] || 1;
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const target = normPlayerId_(playerId);

  let hit = null;
  for (const r of rows) {
    if (normPlayerId_(r[colPid - 1]) === target) hit = r;
  }

  const headers = [];
  const values = [];

  for (let c = 1; c <= lastCol; c++) {
    if (c === colPid) continue;

    headers.push(headerRow[c - 1] || '');
    const v = hit ? hit[c - 1] : '';

    if (opt?.kind === 'bool') {
      const s = String(v ?? '').trim().toLowerCase();
      values.push(v === true || s === 'true' || s === '1' || s === 'yes' || s === 'on');
    } else {
      const n = Number(v);
      values.push(Number.isFinite(n) ? n : 0);
    }
  }

  return { headers, values };
}

function getOptionalSheetByCandidates_(names) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const name of names) {
    const sh = ss.getSheetByName(name);
    if (sh) return sh;
  }
  return null;
}

// ---- tournament results ----
function getTournamentResultsByPlayer_(playerId) {
  const sh = getOptionalSheetByCandidates_(RESULT_SHEET_CANDIDATES);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const hmap = getHeaderMap_(sh);
  const colPid = pickCol_(hmap, ['playerid']) || 1;
  const colTid = pickCol_(hmap, ['tournamentid']) || 2;
  const colRank = pickCol_(hmap, ['rank', '順位', 'result']) || 3;

  const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const target = normPlayerId_(playerId);

  const nameMap = buildTournamentNameMap_();

  const out = [];
  for (const r of rows) {
    if (normPlayerId_(r[colPid - 1]) !== target) continue;

    const tid = String(r[colTid - 1] ?? '').trim();
    const rank = r[colRank - 1];

    out.push({
      tournamentId: tid,
      tournamentName: nameMap[tid] || tid,
      rank: rank,
    });
  }
  return out;
}

function buildTournamentNameMap_() {
  const map = {};
  try {
    // まず Config の TOURNAMENTS_SHEET を優先。なければ大会管理を探す
    let sh = null;
    try { sh = getSheet_(TOURNAMENTS_SHEET); } catch (_) { sh = null; }
    if (!sh) sh = getOptionalSheetByCandidates_(['大会管理', 'tournaments', 'トーナメント管理']);

    if (!sh) return map;

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return map;

    const hmap = getHeaderMap_(sh);
    const colTid = pickCol_(hmap, ['tournamentid']) || 1;
    const colName = pickCol_(hmap, ['tournamentname']) || 2;

    const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (const r of rows) {
      const id = String(r[colTid - 1] ?? '').trim();
      if (!id) continue;
      map[id] = String(r[colName - 1] ?? '').trim() || id;
    }
  } catch (_) { }
  return map;
}

// ---- all season series (Rポイント管理 / レート管理) ----
// 期待するシート形：A列 playerId、B以降 season1, season2, ... の列
function getAllSeasonSeries_(sh, playerId) {
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return [];

  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => String(v ?? '').trim());

  // playerId 列（ヘッダが無い/違う場合は1列目）
  let colPid = 1;
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i].toLowerCase();
    if (h === 'playerid' || h === 'player_id' || h === 'player') {
      colPid = i + 1;
      break;
    }
  }

  // seasonN 列一覧
  const seasonCols = [];
  for (let i = 0; i < headerRow.length; i++) {
    const m = headerRow[i].match(/^season\s*(\d+)$/i);
    if (m) seasonCols.push({ season: Number(m[1]), col: i + 1 });
  }
  seasonCols.sort((a, b) => a.season - b.season);

  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const target = normPlayerId_(playerId);

  let hit = null;
  for (const r of rows) {
    if (normPlayerId_(r[colPid - 1]) === target) {
      hit = r;
      break; // 基本一意想定
    }
  }
  if (!hit) return [];

  const out = [];
  for (const sc of seasonCols) {
    const v = hit[sc.col - 1];
    if (v === '' || v == null) continue;

    const n = toNum_(v);
    if (n == null) continue;

    out.push({ season: sc.season, value: n });
  }
  return out;
}

function getRateOrRPointSheet_(kind) {
  // kind: 'rate' | 'rpoint'
  try {
    if (kind === 'rate') {
      try { return getSheet_(RATE_SHEET); } catch (_) { }
      return getOptionalSheetByCandidates_(RATE_SHEET_CANDIDATES);
    } else {
      try { return getSheet_(RPOINT_SHEET); } catch (_) { }
      return getOptionalSheetByCandidates_(RPOINT_SHEET_CANDIDATES);
    }
  } catch (_) {
    return null;
  }
}
