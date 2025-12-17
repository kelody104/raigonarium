// 12_Swiss.gs
function getSwiss_(e) {
  const tournamentId = String(e?.parameter?.tournamentId || '').trim();
  if (!tournamentId) return json_({ ok: true, matches: [] });

  const sh = getSheet_(SWISS_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, matches: [] });

  const values = sh.getRange(2, 1, lastRow - 1, SWISS_COLS).getValues();

  const matches = values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => ({
      matchId: String(r[0] || ''),
      tournamentId: String(r[1] || ''),
      round: Number(r[2] || 0),
      tableName: String(r[3] || ''),
      p1Id: String(r[4] || ''),
      p2Id: String(r[5] || ''),
      p1Wins: toNum_(r[6]),
      p2Wins: toNum_(r[7]),
      result: String(r[8] || 'NONE'),
      logZipUrl: String(r[9] || ''),
    }))
    .filter(x => x.tournamentId === tournamentId);

  return json_({ ok: true, matches, rows: matches });
}

function updateSwissLog_(body) {
  try {
    const matchId = String(body.matchId || '').trim();
    const logZipUrl = String(body.logZipUrl || '').trim();

    if (!matchId) return json_({ ok: false, error: 'matchId is required' });
    if (!logZipUrl) return json_({ ok: false, error: 'logZipUrl is required' });

    const sh = getSheet_(SWISS_SHEET);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return json_({ ok: false, error: 'no rows' });

    const hmap = getHeaderMap_(sh);
    const colMatch = pickCol_(hmap, ['matchid', 'match_id']) || 1;
    const colLog = pickCol_(hmap, ['logzipurl', 'log_zip_url', 'logurl', 'log_url']) || 10;

    const found = sh.getRange(2, colMatch, lastRow - 1, 1)
      .createTextFinder(matchId).matchEntireCell(true).findNext();

    if (!found) return json_({ ok: false, error: 'match not found', debug: { matchId } });

    const rowNumber = found.getRow();
    sh.getRange(rowNumber, colLog).setValue(logZipUrl);

    return json_({ ok: true, rowNumber });
  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in updateSwissLog',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? '')
    });
  }
}
