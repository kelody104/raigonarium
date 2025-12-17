// 20_Members.gs
function loginMember_(body) {
  try {
    const playerIdInput = String(body.playerId || '').trim();
    const password = String(body.password || '').trim();

    if (!playerIdInput) return json_({ ok: false, error: 'playerId is required' });
    if (!password) return json_({ ok: false, error: 'password is required' });

    const sh = getSheet_(MEMBERS_SHEET);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return json_({ ok: false, error: 'no members' });

    const hmap = getHeaderMap_(sh);

    const colPlayerId   = pickCol_(hmap, ['playerid'])   || 1;
    const colPlayerName = pickCol_(hmap, ['playername']) || 2;
    const colPassword   = pickCol_(hmap, ['password'])   || 3;
    const colFamilyName = pickCol_(hmap, ['familyname']) || 4;
    const colRegion     = pickCol_(hmap, ['region'])     || 5;
    const colRank       = pickCol_(hmap, ['rank'])       || 6;
    const colStatus     = pickCol_(hmap, ['status'])     || 7;

    // playerId を検索（完全一致）
    let found = sh.getRange(2, colPlayerId, lastRow - 1, 1)
      .createTextFinder(playerIdInput).matchEntireCell(true).findNext();

    // もしシート側が数値(1)で入ってて、入力が"001"みたいなケースの保険
    if (!found) {
      const n = Number(playerIdInput);
      if (Number.isFinite(n)) {
        found = sh.getRange(2, colPlayerId, lastRow - 1, 1)
          .createTextFinder(String(n)).matchEntireCell(true).findNext();
      }
    }

    if (!found) return json_({ ok: false, error: 'invalid playerId or password' });

    const row = found.getRow();
    const rowVals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];

    const pw = String(rowVals[colPassword - 1] ?? '').trim();
    if (pw !== password) return json_({ ok: false, error: 'invalid playerId or password' });

    const statusVal = rowVals[colStatus - 1];
    if (typeof normBoolActive_ === 'function') {
      if (!normBoolActive_(statusVal)) return json_({ ok: false, error: 'inactive account' });
    } else {
      const s = String(statusVal ?? '').trim().toLowerCase();
      if (s && s !== 'active') return json_({ ok: false, error: 'inactive account' });
    }

    const pid        = String(rowVals[colPlayerId - 1] ?? '').trim();
    const playerName = String(rowVals[colPlayerName - 1] ?? '').trim();
    const familyName = String(rowVals[colFamilyName - 1] ?? '').trim();
    const region     = String(rowVals[colRegion - 1] ?? '').trim();
    const rank       = String(rowVals[colRank - 1] ?? '').trim();
    const status     = String(statusVal ?? '').trim();

    // ===== ここから追加：今季 / Rポイント / レート =====

    // シート名候補（必要ならここだけあなたの実名に合わせて調整）
    const RATE_SHEET_CANDIDATES   = ['レート管理', 'Rate', 'rate'];
    const RPOINT_SHEET_CANDIDATES = ['Rポイント管理', 'Rポイント管理シート', 'RPoint', 'rpoint'];

    const season = (typeof getCurrentSeason_ === 'function')
      ? getCurrentSeason_()
      : resolveCurrentSeasonFallback_();

    const rPoint = (typeof getRPointByPlayer_ === 'function')
      ? getRPointByPlayer_(pid, season)
      : readNumericByPlayerSeason_(RPOINT_SHEET_CANDIDATES, pid, season, [
          'rpoint', 'r_points', 'rポイント', 'rpointtotal', 'point', 'points', 'rp'
        ]);

    const rate = (typeof getRateByPlayer_ === 'function')
      ? getRateByPlayer_(pid, season)
      : readNumericByPlayerSeason_(RATE_SHEET_CANDIDATES, pid, season, [
          'rate', 'rating', 'レート'
        ]);

    // ===== 追加ここまで =====

    const member = { playerId: pid, playerName, familyName, region, rank, status, season, rPoint, rate };
    // ★追加：今季レート/Rポイント
    let stats = {};
    try {
      stats = getRateAndRPoint_(pid);
    } catch (e) {
      // ここで落とさない（ログイン自体は通す）
      stats = {};
    }

    return json_({
      ok: true,
      member: { playerId: pid, playerName, familyName, region, rank, status, ...stats },
      user:   { playerId: pid, playerName, familyName, region, rank, status, ...stats } // 互換
    });

    // ----------------- local helpers -----------------

    function resolveCurrentSeasonFallback_() {
      // 既存 getCurrentSeason_ が無い場合だけ使う最低限フォールバック
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const shSeason =
        ss.getSheetByName('season') ||
        ss.getSheetByName('シーズン管理') ||
        ss.getSheetByName('Seasons');
      if (!shSeason) return null;

      const last = shSeason.getLastRow();
      if (last < 2) return null;

      const h = getHeaderMap_(shSeason);
      const cSeason = pickCol_(h, ['season', 'シーズン']) || 1;
      const cStart  = pickCol_(h, ['seasonstart', 'start', '開始']) || 2;
      const cEnd    = pickCol_(h, ['seasonend', 'end', '終了']) || 3;

      const now = new Date();
      const rows = shSeason.getRange(2, 1, last - 1, shSeason.getLastColumn()).getValues();

      // 期間内ヒット優先。無ければ最大 season を返す
      let maxSeason = null;
      for (const r of rows) {
        const s = r[cSeason - 1];
        const st = r[cStart - 1];
        const en = r[cEnd - 1];
        const start = (st instanceof Date) ? st : new Date(st);
        const end   = (en instanceof Date) ? en : new Date(en);
        if (!isNaN(start) && !isNaN(end) && start <= now && now <= end) return s;
        if (maxSeason == null || Number(s) > Number(maxSeason)) maxSeason = s;
      }
      return maxSeason;
    }

    function readNumericByPlayerSeason_(sheetNameCandidates, playerId, seasonVal, valueColCandidates) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = sheetNameCandidates.map(n => ss.getSheetByName(n)).find(Boolean);
      if (!sh) return 0;

      const last = sh.getLastRow();
      if (last < 2) return 0;

      const h = getHeaderMap_(sh);

      const cPid = pickCol_(h, ['playerid', 'playerId', 'pid', 'id']) || 1;
      const cSeason = pickCol_(h, ['season', 'シーズン']);
      const cVal = pickCol_(h, valueColCandidates) || 3;

      const rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();

      // playerId & season で最後に見つかった値（新しい行優先）
      let hit = null;
      for (const r of rows) {
        const pidCell = String(r[cPid - 1] ?? '').trim();
        const pidNum = Number(pidCell);
        const inNum = Number(playerId);

        const pidMatch =
          pidCell === String(playerId) ||
          (Number.isFinite(pidNum) && Number.isFinite(inNum) && pidNum === inNum);

        if (!pidMatch) continue;

        if (cSeason) {
          const sCell = String(r[cSeason - 1] ?? '').trim();
          if (String(seasonVal ?? '').trim() !== sCell) continue;
        }

        hit = r[cVal - 1];
      }

      const n = Number(hit);
      return Number.isFinite(n) ? n : 0;
    }
  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in loginMember',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}
