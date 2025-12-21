// 03_EntryWrite.gs

function appendEntry_(body) {
  const tournamentId = String(body?.tournamentId || '').trim();
  const playerId = String(body?.playerId || '').trim();
  const role = 'PLAYER';

  if (!tournamentId || !playerId) {
    return json_({ ok: false, error: 'bad_request', message: 'tournamentId/playerId required' });
  }

  const sh = getSheet_(ENTRIES_SHEET);
  const ENTRY_COLS_LOCAL = (typeof ENTRY_COLS === 'number') ? ENTRY_COLS : 15; // entryId..item10

  const lastRow = sh.getLastRow();
  const values = (lastRow >= 2)
    ? sh.getRange(2, 1, lastRow - 1, 5).getValues()   // A〜E だけ（entryId,tournamentId,playerId,role,active）
    : [];

  // 既存行を末尾から探す（role=PLAYER のみ対象）
  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const t = String(r[1] || '').trim();
    const p = String(r[2] || '').trim();
    const ro = String(r[3] || '').trim().toUpperCase();
    if (t !== tournamentId || p !== playerId || ro !== 'PLAYER') continue;

    const entryId = String(r[0] || '').trim();
    const isActive = normBoolActive_(r[4]); // TRUE/空→true, FALSE→false

    // ★取り消し済みなら再有効化
    if (!isActive) {
      sh.getRange(2 + i, 5).setValue('TRUE'); // active列(E)
      return json_({ ok: true, existed: true, reactivated: true, entryId });
    }

    // 既に有効
    return json_({ ok: true, existed: true, entryId });
  }

  // 新規追加（entryId は最大+1）
  let maxId = 0;
  for (let i = 0; i < values.length; i++) {
    const n = parseInt(String(values[i][0] || '').trim(), 10);
    if (!isNaN(n)) maxId = Math.max(maxId, n);
  }
  const nextId = maxId + 1;

  const row = [
    nextId,
    tournamentId,
    playerId,
    role,
    'TRUE',
    '', '', '', '', '', '', '', '', '', '' // item1..10
  ];

  sh.appendRow(row);
  return json_({ ok: true, existed: false, entryId: String(nextId) });
}

function cancelEntry_(body) {
  const tournamentId = String(body?.tournamentId || '').trim();
  const playerId = String(body?.playerId || '').trim();

  if (!tournamentId || !playerId) {
    return json_({ ok: false, error: 'bad_request', message: 'tournamentId/playerId required' });
  }

  const sh = getSheet_(ENTRIES_SHEET);
  const lastRow = sh.getLastRow();
  const values = (lastRow >= 2)
    ? sh.getRange(2, 1, lastRow - 1, 5).getValues()
    : [];

  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const t = String(r[1] || '').trim();
    const p = String(r[2] || '').trim();
    const ro = String(r[3] || '').trim().toUpperCase();
    if (t !== tournamentId || p !== playerId || ro !== 'PLAYER') continue;

    const entryId = String(r[0] || '').trim();
    const isActive = normBoolActive_(r[4]);

    if (isActive) {
      sh.getRange(2 + i, 5).setValue('FALSE');
      return json_({ ok: true, existed: true, canceled: true, entryId });
    }
    return json_({ ok: true, existed: true, canceled: false, alreadyCanceled: true, entryId });
  }

  // 見つからない（未エントリー扱い）
  return json_({ ok: true, existed: false, canceled: false });
}
