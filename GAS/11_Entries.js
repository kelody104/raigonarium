function getEntriesByTournament_(e) {
  const sh = getSheet_(ENTRIES_SHEET);

  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: true, rows: [] });

  const limit = Math.min(Number(e?.parameter?.limit || 500), 2000);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const values = sh.getRange(2, 1, lastRow - 1, ENTRY_COLS).getValues();

  const filtered = values
    .map((r, i) => ({
      rowNumber: 2 + i,
      entryId: String(r[0] || '').trim(),
      tournamentId: String(r[1] || '').trim(),
      playerId: String(r[2] || '').trim(),
      role: String(r[3] || '').trim(),
      active: String(r[4] ?? '').trim().toUpperCase(), // TRUE/FALSE (false を潰さない)
      items: r.slice(5, 15).map(v => (v === null || v === undefined) ? '' : String(v)) // item1..10
    }))
    .filter(x => x.tournamentId === tournamentId);

  return json_({ ok: true, rows: filtered.slice(0, limit) });
}

/**
 * 旧仕様互換：entryId パラメータが playerId として渡ってくるケースを吸収
 * - entryId が「playerId」だったら (tournamentId, playerId) で探す
 * - entryId が本当の entryId なら (tournamentId, entryId) で探す
 */
function getEntry_(e) {
  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  const entryIdOrPlayerId = String(e?.parameter?.entryId || '').trim();
  if (!tournamentId || !entryIdOrPlayerId) return json_({ ok: true, entry: null });

  const sh = getSheet_(ENTRIES_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, entry: null });

  const values = sh.getRange(2, 1, lastRow - 1, ENTRY_COLS).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const entryId = String(r[0] || '').trim();
    const t = String(r[1] || '').trim();
    const p = String(r[2] || '').trim();

    if (t !== tournamentId) continue;

    // entryId として一致 or playerId として一致
    if (entryId === entryIdOrPlayerId || p === entryIdOrPlayerId) {
      return json_({
        ok: true,
        entry: {
          rowNumber: 2 + i,
          entryId,
          tournamentId: t,
          playerId: p,
          role: String(r[3] || '').trim(),
          active: String(r[4] ?? '').trim().toUpperCase(),
          items: r.slice(5, 15).map(v => (v === null || v === undefined) ? '' : String(v))
        }
      });
    }
  }

  return json_({ ok: true, entry: null });
}

function getEntriesByPlayerId_(e) {
  const sh = getSheet_(ENTRIES_SHEET);

  const playerId = String(e?.parameter?.playerId || '').trim();
  if (!playerId) return json_({ ok: true, rows: [] });

  const limit = Math.min(Number(e?.parameter?.limit || 200), 2000);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const values = sh.getRange(2, 1, lastRow - 1, ENTRY_COLS).getValues();

  const filtered = values
    .map((r, i) => ({
      rowNumber: 2 + i,
      entryId: String(r[0] || '').trim(),
      tournamentId: String(r[1] || '').trim(),
      playerId: String(r[2] || '').trim(),
      role: String(r[3] || '').trim(),
      active: String(r[4] ?? '').trim().toUpperCase(),
      items: r.slice(5, 15).map(v => (v === null || v === undefined) ? '' : String(v))
    }))
    .filter(x => x.playerId === playerId);

  // 末尾から limit 件（従来挙動に寄せる）
  return json_({ ok: true, rows: filtered.slice(Math.max(0, filtered.length - limit)) });
}
