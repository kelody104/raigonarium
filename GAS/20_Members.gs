// 20_Members.gs

function loginMember_(body) {
  try {
    const playerIdInput = String(body?.playerId ?? '').trim();
    const password = String(body?.password ?? '').trim();

    if (!playerIdInput) return json_({ ok: false, error: 'playerId is required' });
    if (!password) return json_({ ok: false, error: 'password is required' });

    // ★ digits only（例: "001" / "1"）。"t001" はエラーで正
    if (!/^\d+$/.test(playerIdInput)) {
      return json_({ ok: false, error: 'playerId must be digits like 001' });
    }

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
    const colRaijin     = pickCol_(hmap, ['raijin'])     || 7; // ★追加
    const colStatus     = pickCol_(hmap, ['status'])     || 8;

    // 入力は "001" でも、シートが数値(1)でも当てる
    const pidCanon = normalizeDigitsPlayerId_(playerIdInput);   // "001" -> "1"
    const pidPad3  = String(Number(playerIdInput)).padStart(3, '0'); // "1" -> "001"（保険）

    const finderRange = sh.getRange(2, colPlayerId, lastRow - 1, 1);

    let found =
      finderRange.createTextFinder(playerIdInput).matchEntireCell(true).findNext()
      || finderRange.createTextFinder(pidCanon).matchEntireCell(true).findNext()
      || finderRange.createTextFinder(pidPad3).matchEntireCell(true).findNext();

    if (!found) return json_({ ok: false, error: 'invalid playerId or password' });

    const row = found.getRow();
    const rowVals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];

    const pw = String(rowVals[colPassword - 1] ?? '').trim();
    if (pw !== password) return json_({ ok: false, error: 'invalid playerId or password' });

    const statusVal = rowVals[colStatus - 1];

    // Active 判定
    if (typeof normBoolActive_ === 'function') {
      if (!normBoolActive_(statusVal)) return json_({ ok: false, error: 'inactive account' });
    } else {
      const s = String(statusVal ?? '').trim().toLowerCase();
      if (s && s !== 'active') return json_({ ok: false, error: 'inactive account' });
    }

    const playerName = String(rowVals[colPlayerName - 1] ?? '').trim();
    const familyName = String(rowVals[colFamilyName - 1] ?? '').trim();
    const region     = String(rowVals[colRegion - 1] ?? '').trim();
    const rank       = String(rowVals[colRank - 1] ?? '').trim();
    const raijin     = String(rowVals[colRaijin - 1] ?? '').trim(); // ★追加
    const status     = String(statusVal ?? '').trim();

    // ★返す playerId は「数値化してゼロ埋めしない」(1,2,3,...) に統一
    const pid = pidCanon;

    // ★今季 stats（22_Stats.gs）
    let season = null;
    let rate = 0;
    let rPoint = 0;

    try {
      if (typeof getRateAndRPoint_ === 'function') {
        const s = getRateAndRPoint_(pid) || {};
        const sn = Number(s.season);
        if (Number.isFinite(sn)) season = sn;

        const rn = Number(s.rate);
        if (Number.isFinite(rn)) rate = rn;

        const pn = Number(s.rPoint);
        if (Number.isFinite(pn)) rPoint = pn;
      }
    } catch (_) {
      // ログイン自体は通す（画面側は ?? 0 で吸収）
    }

    const member = {
      playerId: pid,
      playerName,
      familyName,
      region,
      rank,
      raijin,   // ★返す
      status,
      season,
      rate,
      rPoint,
    };

    // 互換：member / user 両方返す
    return json_({ ok: true, member, user: member });

  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in loginMember',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}

// "001" -> "1"（ゼロ埋めしない）
function normalizeDigitsPlayerId_(s) {
  const t = String(s ?? '').trim();
  if (!/^\d+$/.test(t)) return t;
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  return String(n);
}
