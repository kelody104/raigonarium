// 10_Tournaments.gs
function getTournaments_() {
  const sh = getSheet_(TOURNAMENTS_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json_({ ok: true, tournaments: [] });

  const values = sh.getRange(2, 1, lastRow - 1, TOURN_COLS).getValues();

  const tournaments = values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => ({
      tournamentId: String(r[0] || ''),
      tournamentName: String(r[1] || ''),
      labels: r.slice(2, 22).map(v => (v === null || v === undefined) ? '' : String(v))
    }));

  return json_({ ok: true, tournaments });
}
