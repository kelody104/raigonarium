// 13_Bracket.gs
function getBracket_(e) {
  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: true, matches: [], rows: [] });

  const sh = getSheet_(BRACKET_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, matches: [], rows: [] });

  const values = sh.getRange(2, 1, lastRow - 1, BRACKET_COLS).getValues();

  const matches = values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => ({
      matchId: String(r[0] || '').trim(),
      tournamentId: String(r[1] || '').trim(),
      round: Number(r[2] || 0),
      tableName: String(r[3] || '').trim(),
      bestOf: toNum_(r[4]) || 1,

      p1Id: String(r[5] || '').trim(),
      p2Id: String(r[6] || '').trim(),
      result: String(r[7] || 'NONE').trim(),
      logZipUrl: String(r[8] || '').trim(),

      p1GameWins: toNum_(r[9]),
      p2GameWins: toNum_(r[10]),
      game1Result: String(r[11] || '').trim(),
      game2Result: String(r[12] || '').trim(),
      game3Result: String(r[13] || '').trim(),
      game1LogZipUrl: String(r[14] || '').trim(),
      game2LogZipUrl: String(r[15] || '').trim(),
      game3LogZipUrl: String(r[16] || '').trim(),

      nextMatchId: String(r[17] || '').trim(),
      nextSlot: String(r[18] || '').trim(),
      seed1: toNum_(r[19]),
      seed2: toNum_(r[20]),
    }))
    .filter(x => x.tournamentId === tournamentId);

  return json_({ ok: true, matches, rows: matches });
}
