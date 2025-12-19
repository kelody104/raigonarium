// 02_Router.gs
function doGet(e) {
  try {
    if (String(e?.parameter?.debug || '') === '1') {
      return json_({ ok: true, build: BUILD_ID, debug: e.parameter });
    }

    const action = String(e?.parameter?.action ?? 'entries').trim().toLowerCase();

    if (action === 'season') return getSeason_();
    if (action === 'tournaments') return getTournaments_();
    if (action === 'progress') return getProgress_(e); // ★追加

    if (action === 'entries') return getEntriesByTournament_(e);
    if (action === 'entry') return getEntry_(e);
    if (action === 'swiss') return getSwiss_(e);
    if (action === 'bracket') return getBracket_(e);

    // 互換：旧仕様（playerId検索）
    return getEntriesByPlayerId_(e);

  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in doGet',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}


function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(30000);
    locked = true;

    const body = parseBody_(e);

    if (API_TOKEN) {
      const token = String(body.token || '');
      if (token !== API_TOKEN) return json_({ ok: false, error: 'Unauthorized' });
    }

    const actionRaw = String(body.action || '').trim();
    const action = actionRaw.toLowerCase();

    // ★ season を POST でも許可（フロントを統一しやすい）
    if (action === 'season') return getSeason_();

    // ★追加：progress を POST でも許可（フロント統一しやすい）
    if (action === 'progress') {
      return getProgress_({ parameter: { playerId: body.playerId } });
    }

    // ★ログイン（関数名揺れも吸収）
    if (action === 'login' || action === 'raizanlogin') {
      const fn =
        (typeof loginMember_ === 'function' && loginMember_) ||
        (typeof loginMember === 'function' && loginMember) ||
        (typeof raizanLogin_ === 'function' && raizanLogin_) ||
        (typeof raizanLogin === 'function' && raizanLogin);

      if (fn) return fn(body);

      return json_({ ok: false, error: 'login handler not found', action: actionRaw });
    }

    if (action === 'append') return appendEntry_(body);
    if (action === 'update') return updateEntry_(body);
    if (action === 'uploadlog') return uploadLog_(body);
    if (action === 'updateswisslog') return updateSwissLog_(body);

    return json_({
      ok: false,
      error: 'Unknown action',
      action: actionRaw,
      allowed: ['season', 'login', 'raizanLogin', 'progress', 'append', 'update', 'uploadLog', 'updateSwissLog'],
    });

  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in doPost',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}
