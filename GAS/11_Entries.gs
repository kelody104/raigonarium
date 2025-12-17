// 11_Entries.gs
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
      entryTime: toIso_(r[0]),
      tournamentId: String(r[1] || ''),
      playerId: String(r[2] || ''),
      playerName: String(r[3] || ''),
      items: r.slice(4, 24).map(v => (v === null || v === undefined) ? '' : String(v))
    }))
    .filter(x => x.tournamentId === tournamentId);

  return json_({ ok: true, rows: filtered.slice(0, limit) });
}

function getEntry_(e) {
  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  const entryId = String(e?.parameter?.entryId || '').trim(); // = playerId
  if (!tournamentId || !entryId) return json_({ ok: true, entry: null });

  const sh = getSheet_(ENTRIES_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, entry: null });

  const values = sh.getRange(2, 1, lastRow - 1, ENTRY_COLS).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const t = String(r[1] || '');
    const p = String(r[2] || '');
    if (t === tournamentId && p === entryId) {
      return json_({
        ok: true,
        entry: {
          rowNumber: 2 + i,
          entryTime: toIso_(r[0]),
          tournamentId: t,
          playerId: p,
          playerName: String(r[3] || ''),
          items: r.slice(4, 24).map(v => (v === null || v === undefined) ? '' : String(v))
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

  const limit = Math.min(Number(e?.parameter?.limit || 200), 1000);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const values = sh.getRange(2, 1, lastRow - 1, ENTRY_COLS).getValues();

  const filtered = values
    .map((r, i) => ({
      rowNumber: 2 + i,
      entryTime: toIso_(r[0]),
      tournamentId: String(r[1] || ''),
      playerId: String(r[2] || ''),
      playerName: String(r[3] || ''),
      items: r.slice(4, 24).map(v => (v === null || v === undefined) ? '' : String(v))
    }))
    .filter(x => x.playerId === playerId);

  return json_({ ok: true, rows: filtered.slice(Math.max(0, filtered.length - limit)) });
}

function appendEntry_(body) {
  const sh = getSheet_(ENTRIES_SHEET);

  const tournamentId = String(body.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: false, error: 'tournamentId is required' });

  const playerId = String(body.playerId || '').trim();
  if (!playerId) return json_({ ok: false, error: 'playerId is required' });

  const playerName = String(body.playerName || '').trim();
  if (!playerName) return json_({ ok: false, error: 'playerName is required' });

  const items = normalizeItems_(body.items);

  sh.appendRow([new Date(), tournamentId, playerId, playerName, ...items]);
  return json_({ ok: true });
}

function updateEntry_(body) {
  const sh = getSheet_(ENTRIES_SHEET);

  const rowNumber = Number(body.rowNumber);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return json_({ ok: false, error: 'rowNumber (>=2) is required' });
  }

  const current = sh.getRange(rowNumber, 1, 1, ENTRY_COLS).getValues()[0];

  let entryTime = current[0];
  if (body.entryTime) {
    const d = new Date(body.entryTime);
    if (!isNaN(d.getTime())) entryTime = d;
  }

  let tournamentId = current[1];
  if (body.tournamentId !== undefined) {
    const t = String(body.tournamentId || '').trim();
    if (!t) return json_({ ok: false, error: 'tournamentId cannot be empty' });
    tournamentId = t;
  }

  let playerId = current[2];
  if (body.playerId !== undefined) {
    const p = String(body.playerId || '').trim();
    if (!p) return json_({ ok: false, error: 'playerId cannot be empty' });
    playerId = p;
  }

  let playerName = current[3];
  if (body.playerName !== undefined) {
    const n = String(body.playerName || '').trim();
    if (!n) return json_({ ok: false, error: 'playerName cannot be empty' });
    playerName = n;
  }

  let items = current.slice(4, 24);
  if (body.items !== undefined) items = normalizeItems_(body.items);

  sh.getRange(rowNumber, 1, 1, ENTRY_COLS).setValues([[entryTime, tournamentId, playerId, playerName, ...items]]);
  return json_({ ok: true });
}
