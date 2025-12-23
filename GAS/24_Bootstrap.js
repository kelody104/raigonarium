// 24_Bootstrap.gs
// 大会開始タイミングで：大会管理 → Tournaments、参加者管理 → Entries を作る（Upsert）

function findRowByKey_(sh, keyCol, keyValue) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  const hmap = getHeaderMap_(sh);
  const colKey = pickCol_(hmap, [keyCol]) || 1;

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][colKey - 1] ?? '').trim();
    if (v === keyValue) {
      return { rowNumber: 2 + i, row: values[i], lastCol, hmap };
    }
  }
  return null;
}

function upsertByTournamentId_(srcSh, dstSh, tournamentId) {
  const srcHit = findRowByKey_(srcSh, 'tournamentId', tournamentId);
  if (!srcHit) return { inserted: 0, updated: 0, skipped: 1 };

  const dstLastRow = dstSh.getLastRow();
  const dstLastCol = dstSh.getLastColumn();
  const dstHmap = getHeaderMap_(dstSh);
  const dstTidCol = pickCol_(dstHmap, ['tournamentid']) || 1;

  // 既存検索
  let existingRow = null;
  if (dstLastRow >= 2) {
    const vals = dstSh.getRange(2, dstTidCol, dstLastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0] ?? '').trim() === tournamentId) {
        existingRow = 2 + i;
        break;
      }
    }
  }

  // dst のヘッダに合わせて src から詰め替え
  const out = new Array(dstLastCol).fill('');
  for (const [k, col] of Object.entries(dstHmap)) {
    const srcCol = srcHit.hmap[k];
    if (!srcCol) continue;
    out[col - 1] = srcHit.row[srcCol - 1];
  }

  if (existingRow) {
    dstSh.getRange(existingRow, 1, 1, dstLastCol).setValues([out]);
    return { inserted: 0, updated: 1, skipped: 0 };
  } else {
    dstSh.appendRow(out);
    return { inserted: 1, updated: 0, skipped: 0 };
  }
}

function upsertEntriesFromMaster_(entriesMasterSh, entriesSh, tournamentId) {
  const lastRow = entriesMasterSh.getLastRow();
  const lastCol = entriesMasterSh.getLastColumn();
  if (lastRow < 2) return { inserted: 0, updated: 0 };

  const hmap = getHeaderMap_(entriesMasterSh);
  const colEntryId = pickCol_(hmap, ['entryid']) || 1;
  const colTid = pickCol_(hmap, ['tournamentid']) || 2;
  const colPid = pickCol_(hmap, ['playerid']) || 3;
  const colRole = pickCol_(hmap, ['role']) || 4;
  const colActive = pickCol_(hmap, ['active']) || 5;

  const srcRows = entriesMasterSh.getRange(2, 1, lastRow - 1, lastCol).getValues()
    .map(r => ({
      entryId: String(r[colEntryId - 1] ?? '').trim(),
      tournamentId: String(r[colTid - 1] ?? '').trim(),
      playerId: String(r[colPid - 1] ?? '').trim(),
      role: String(r[colRole - 1] ?? '').trim() || 'PLAYER',
      activeRaw: r[colActive - 1],
      active: normBoolActive_(r[colActive - 1]),
    }))
    .filter(x => x.tournamentId === tournamentId)
    .filter(x => x.role.toUpperCase() === 'PLAYER')
    .filter(x => x.active); // active=true のみ転記

  if (!srcRows.length) return { inserted: 0, updated: 0 };

  const dstLastCol = entriesSh.getLastColumn();
  const dstHmap = getHeaderMap_(entriesSh);
  const dstEntryIdCol = pickCol_(dstHmap, ['entryid']) || 1;
  const dstTidCol = pickCol_(dstHmap, ['tournamentid']) || 2;
  const dstPidCol = pickCol_(dstHmap, ['playerid']) || 3;
  const dstRoleCol = pickCol_(dstHmap, ['role']) || 4;
  const dstActiveCol = pickCol_(dstHmap, ['active']) || 5;

  // 既存を (tournamentId, playerId, role) でマップ化
  const dstLastRow = entriesSh.getLastRow();
  const existingMap = new Map();
  if (dstLastRow >= 2) {
    const dstValues = entriesSh.getRange(2, 1, dstLastRow - 1, dstLastCol).getValues();
    for (let i = 0; i < dstValues.length; i++) {
      const r = dstValues[i];
      const t = String(r[dstTidCol - 1] ?? '').trim();
      const p = String(r[dstPidCol - 1] ?? '').trim();
      const ro = String(r[dstRoleCol - 1] ?? '').trim().toUpperCase();
      if (!t || !p) continue;
      existingMap.set(`${t}__${p}__${ro}`, 2 + i);
    }
  }

  // entryId 採番用
  let maxEntryId = 0;
  if (dstLastRow >= 2) {
    const colVals = entriesSh.getRange(2, dstEntryIdCol, dstLastRow - 1, 1).getValues();
    for (const v of colVals) {
      const n = parseInt(String(v[0] ?? '').trim(), 10);
      if (!isNaN(n)) maxEntryId = Math.max(maxEntryId, n);
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const s of srcRows) {
    const key = `${s.tournamentId}__${s.playerId}__${String(s.role).toUpperCase()}`;
    const existingRow = existingMap.get(key);

    const out = new Array(dstLastCol).fill('');
    // entryId：srcが数値なら採用、無いなら採番
    let entryId = s.entryId;
    if (!entryId) {
      maxEntryId += 1;
      entryId = String(maxEntryId);
    }
    out[dstEntryIdCol - 1] = entryId;
    out[dstTidCol - 1] = s.tournamentId;
    out[dstPidCol - 1] = s.playerId;
    out[dstRoleCol - 1] = s.role;
    out[dstActiveCol - 1] = 'TRUE';

    if (existingRow) {
      entriesSh.getRange(existingRow, 1, 1, dstLastCol).setValues([out]);
      updated += 1;
    } else {
      entriesSh.appendRow(out);
      inserted += 1;
    }
  }

  return { inserted, updated };
}

function bootstrapTournament_(body) {
  const tournamentId = String(body?.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: false, error: 'bad_request', message: 'tournamentId required' });

  const tournamentsMaster = getSheetByCandidates_(SHEET_CANDIDATES.tournamentsMaster, 'tournamentsMaster');
  const entriesMaster = getSheetByCandidates_(SHEET_CANDIDATES.entriesMaster, 'entriesMaster');

  const tournaments = getSheetByCandidates_(SHEET_CANDIDATES.tournaments, 'tournaments');
  const entries = getSheetByCandidates_(SHEET_CANDIDATES.entries, 'entries');

  const tRes = upsertByTournamentId_(tournamentsMaster, tournaments, tournamentId);
  const eRes = upsertEntriesFromMaster_(entriesMaster, entries, tournamentId);

  return json_({
    ok: true,
    tournamentId,
    tournaments: tRes,
    entries: eRes,
  });
}
