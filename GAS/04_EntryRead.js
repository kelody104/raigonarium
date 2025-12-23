// 04_EntryRead.gs

function getEntriesByTournament_(e) {
  const sh = getSheetByCandidates_(SHEET_CANDIDATES.entriesMaster, 'entriesMaster');

  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: true, rows: [] });

  const limit = Math.min(Number(e?.parameter?.limit || 500), 2000);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const hmap = getHeaderMap_(sh);
  const colEntryId = pickCol_(hmap, ['entryid']) || 1;
  const colTid = pickCol_(hmap, ['tournamentid']) || 2;
  const colPid = pickCol_(hmap, ['playerid']) || 3;
  const colRole = pickCol_(hmap, ['role']) || 4;
  const colActive = pickCol_(hmap, ['active']) || 5;

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const filtered = values
    .map((r, i) => ({
      rowNumber: 2 + i,
      entryId: String(r[colEntryId - 1] ?? '').trim(),
      tournamentId: String(r[colTid - 1] ?? '').trim(),
      playerId: String(r[colPid - 1] ?? '').trim(),
      role: String(r[colRole - 1] ?? '').trim(),
      active: String(r[colActive - 1] ?? '').trim().toUpperCase(), // false潰し対策
    }))
    .filter(x => x.tournamentId === tournamentId);

  return json_({ ok: true, rows: filtered.slice(0, limit) });
}

/**
 * 旧互換：entryId パラメータが playerId として渡ってくるケースも吸収
 */
function getEntry_(e) {
  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  const entryIdOrPlayerId = String(e?.parameter?.entryId || '').trim();
  if (!tournamentId || !entryIdOrPlayerId) return json_({ ok: true, entry: null });

  const sh = getSheetByCandidates_(SHEET_CANDIDATES.entriesMaster, 'entriesMaster');

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return json_({ ok: true, entry: null });

  const hmap = getHeaderMap_(sh);
  const colEntryId = pickCol_(hmap, ['entryid']) || 1;
  const colTid = pickCol_(hmap, ['tournamentid']) || 2;
  const colPid = pickCol_(hmap, ['playerid']) || 3;
  const colRole = pickCol_(hmap, ['role']) || 4;
  const colActive = pickCol_(hmap, ['active']) || 5;

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const t = String(r[colTid - 1] ?? '').trim();
    if (t !== tournamentId) continue;

    const entryId = String(r[colEntryId - 1] ?? '').trim();
    const p = String(r[colPid - 1] ?? '').trim();

    if (entryId === entryIdOrPlayerId || p === entryIdOrPlayerId) {
      return json_({
        ok: true,
        entry: {
          rowNumber: 2 + i,
          entryId,
          tournamentId: t,
          playerId: p,
          role: String(r[colRole - 1] ?? '').trim(),
          active: String(r[colActive - 1] ?? '').trim().toUpperCase(),
        }
      });
    }
  }

  return json_({ ok: true, entry: null });
}

function getEntriesByPlayerId_(e) {
  const sh = getSheetByCandidates_(SHEET_CANDIDATES.entriesMaster, 'entriesMaster');

  const playerId = String(e?.parameter?.playerId || '').trim();
  if (!playerId) return json_({ ok: true, rows: [] });

  const limit = Math.min(Number(e?.parameter?.limit || 200), 2000);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const hmap = getHeaderMap_(sh);
  const colEntryId = pickCol_(hmap, ['entryid']) || 1;
  const colTid = pickCol_(hmap, ['tournamentid']) || 2;
  const colPid = pickCol_(hmap, ['playerid']) || 3;
  const colRole = pickCol_(hmap, ['role']) || 4;
  const colActive = pickCol_(hmap, ['active']) || 5;

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const filtered = values
    .map((r, i) => ({
      rowNumber: 2 + i,
      entryId: String(r[colEntryId - 1] ?? '').trim(),
      tournamentId: String(r[colTid - 1] ?? '').trim(),
      playerId: String(r[colPid - 1] ?? '').trim(),
      role: String(r[colRole - 1] ?? '').trim(),
      active: String(r[colActive - 1] ?? '').trim().toUpperCase(),
    }))
    .filter(x => x.playerId === playerId);

  return json_({ ok: true, rows: filtered.slice(Math.max(0, filtered.length - limit)) });
}
