function getPlayers_(e) {
  const sh = getSheet_('Players'); // シート名に合わせて
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return json_({ ok: true, rows: [] });

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // ヘッダ位置が固定なら index を合わせてください
  // 例：playerId, familyName, playerName, rank, rate が先頭にある想定
  const rows = values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => ({
      playerId: String(r[0] || '').trim(),
      familyName: String(r[1] || '').trim(),
      playerName: String(r[2] || '').trim(),
      rank: String(r[3] || '').trim(),
      rate: String(r[4] || '').trim(),
    }));

  return json_({ ok: true, rows });
}
