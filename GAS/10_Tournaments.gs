function getTournaments_() {
  const sh = getSheet_(TOURNAMENTS_SHEET);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return json_({ ok: true, tournaments: [] });

  // ヘッダを正規化（空白/全角空白/アンダースコア/ハイフン/大小文字差を吸収）
  const norm = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[ \u3000]/g, '')   // 半角/全角スペース除去
      .replace(/[_-]/g, '');       // _ や - を除去

  const headerRaw = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const header = headerRaw.map(v => norm(v));

  const idx = (name) => header.findIndex(h => h === norm(name));
  const idxAny = (names) => {
    for (const n of names) {
      const i = idx(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  // ※あなたの大会管理シート（画像）に合わせた列名を中心に、揺れも吸収
  const col = {
    tournamentId:   idxAny(['tournamentId', 'id']),
    tournamentName: idxAny(['tournamentName']),
    organizerName:  idxAny(['organizerName', 'organizer', 'organaizerName']),
    eventType:      idxAny(['eventType']),

    eventVenue:     idxAny(['eventVenue']),
    venueAddress:   idxAny(['VenueAddress', 'venueAddress']),

    receptionStartDate: idxAny(['receptionStartDate']),
    receptionEndDate:   idxAny(['receptionEndDate']),

    tournamentStartDate: idxAny(['tournamentstartDate', 'tournamentStartDate']),
    tournamentEndDate:   idxAny(['tournamentEndDate']),

    capacity:      idxAny(['capacity']),
    swissMaxRound: idxAny(['swissMaxRound']),
    bracketMaxRound: idxAny(['bracketMaxRound', 'bracketMaxRour', 'bracketMaxRoun', 'bracketMaxR']),

    topCutMethod: idxAny(['topCutMethod']),
    topCut:       idxAny(['topCut']),

    url:    idxAny(['url', 'URL', 'Url']),
    status: idxAny(['status', 'Status']),
  };

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const get = (r, i, fallback = '') => (i >= 0 ? r[i] : fallback);

  const tournaments = values
    .map((r, rowIdx) => {
      // tournamentId が取れない場合の保険（基本はシートにある前提）
      const rawId = String(get(r, col.tournamentId, '') || '').trim();
      const tournamentId = rawId || String(rowIdx + 2);

      const tournamentName = String(get(r, col.tournamentName, '') || '').trim();

      const receptionStart = get(r, col.receptionStartDate, null);
      const receptionEnd   = get(r, col.receptionEndDate, null);
      const tournamentStart = get(r, col.tournamentStartDate, null);
      const tournamentEnd   = get(r, col.tournamentEndDate, null);

      const statusRaw = String(get(r, col.status, '') || '').trim();
      const status = statusRaw || computeStatus_(receptionStart, receptionEnd, tournamentStart, tournamentEnd);

      return {
        tournamentId,
        tournamentName,

        organizerName: String(get(r, col.organizerName, '') || '').trim(),
        eventType: String(get(r, col.eventType, '') || '').trim(),

        eventVenue: String(get(r, col.eventVenue, '') || '').trim(),
        venueAddress: String(get(r, col.venueAddress, '') || '').trim(),

        receptionStartDate: toIso_(receptionStart),
        receptionEndDate: toIso_(receptionEnd),
        tournamentStartDate: toIso_(tournamentStart),
        tournamentEndDate: toIso_(tournamentEnd),

        capacity: Number(get(r, col.capacity, 0) || 0),
        swissMaxRound: Number(get(r, col.swissMaxRound, 0) || 0),
        bracketMaxRound: Number(get(r, col.bracketMaxRound, 0) || 0),

        topCutMethod: String(get(r, col.topCutMethod, '') || '').trim(),
        topCut: Number(get(r, col.topCut, 0) || 0),

        url: String(get(r, col.url, '') || '').trim(),
        status,
      };
    })
    // tournamentName が空の行は落とす（途中の空行対策）
    .filter(x => String(x.tournamentName || '').trim() !== '');

  return json_({ ok: true, tournaments });
}


// status 列が空でも動くように日付から算出（保険）
function computeStatus_(receptionStart, receptionEnd, tournamentStart, tournamentEnd) {
  const now = new Date();

  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const rs = toDate(receptionStart);
  const re = toDate(receptionEnd);
  const ts = toDate(tournamentStart);
  const te = toDate(tournamentEnd);

  // 開催中
  if (ts && te && now >= ts && now <= te) return 'OPEN';
  // 受付中
  if (rs && re && now >= rs && now <= re) return 'RECEPTION';
  // 受付前
  if (rs && now < rs) return 'ANNOUNCEMENT';
  // 受付終了（受付後〜開始前）
  if (re && ts && now > re && now < ts) return 'STAND-BY';
  // 終了
  if (te && now > te) return 'CLOSE';

  return 'ANNOUNCEMENT';
}
