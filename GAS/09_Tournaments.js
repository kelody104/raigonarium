// 09_Tournaments.gs
function getTournaments_() {
  const sh = getSheet_(TOURNAMENTS_SHEET);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return json_({ ok: true, tournaments: [] });

  const h = getHeaderMap_(sh);

  const cId = pickCol_(h, ['tournamentid']) || 1;
  const cName = pickCol_(h, ['tournamentname']) || 2;
  const cOrg = pickCol_(h, ['organizerplayerid', 'organizerid']) || 0;
  const cStatus = pickCol_(h, ['status']) || 0;
  const cCap = pickCol_(h, ['capacity']) || 0;
  const cSwiss = pickCol_(h, ['swissmaxrounds', 'swissmaxround']) || 0;
  const cTopCutMode = pickCol_(h, ['topcutmode']) || 0;
  const cTopCutVal = pickCol_(h, ['topcutvalue', 'topcut']) || 0;
  const cBracket = pickCol_(h, ['bracketmaxrounds', 'bracketmaxround']) || 0;
  const cCreated = pickCol_(h, ['createdat']) || 0;
  const cUpdated = pickCol_(h, ['updatedat']) || 0;

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const tournaments = values
    .map((r) => ({
      tournamentId: String(r[cId - 1] ?? '').trim(),
      tournamentName: String(r[cName - 1] ?? '').trim(),
      organizerPlayerId: cOrg ? String(r[cOrg - 1] ?? '').trim() : '',
      status: cStatus ? String(r[cStatus - 1] ?? '').trim() : '',
      capacity: cCap ? Number(r[cCap - 1] || 0) : 0,
      swissMaxRounds: cSwiss ? Number(r[cSwiss - 1] || 0) : 0,
      topCutMode: cTopCutMode ? String(r[cTopCutMode - 1] ?? '').trim() : '',
      topCutValue: cTopCutVal ? Number(r[cTopCutVal - 1] || 0) : 0,
      bracketMaxRounds: cBracket ? Number(r[cBracket - 1] || 0) : 0,
      createdAt: cCreated ? toIso_(r[cCreated - 1]) : '',
      updatedAt: cUpdated ? toIso_(r[cUpdated - 1]) : '',
    }))
    .filter(x => x.tournamentId && x.tournamentName);

  return json_({ ok: true, tournaments });
}
