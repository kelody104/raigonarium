// 02_Router.gs
function authorize_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  const token = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';
  return token && expected && token === expected;
}

function authorize_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
  const token = String(e?.parameter?.token || '');
  return expected !== '' && token === expected;
}

function unauthorized_() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (!authorize_(e)) return unauthorized_();

  try {
    const action = String(e?.parameter?.action ?? 'entries').trim().toLowerCase();

    // ★疎通確認を明示（おすすめ）
    if (action === 'ping') return json_({ ok: true, build: BUILD_ID, ts: Date.now() });

    if (String(e?.parameter?.debug || '') === '1') {
      return json_({ ok: true, build: BUILD_ID, debug: e.parameter });
    }

    if (action === 'season') return getSeason_();
    if (action === 'tournaments') return getTournaments_();
    if (action === 'progress') return getProgress_(e);

    if (action === 'entries') return getEntriesByTournament_(e);
    if (action === 'entry') return getEntry_(e);
    if (action === 'swiss') return getSwiss_(e);
    if (action === 'bracket') return getBracket_(e);
    if (action === 'players') return getPlayers_(e);

    return getEntriesByPlayerId_(e);
  } catch (err) {
    return json_({ ok:false, error:'Exception in doGet', message:String(err?.message ?? err), stack:String(err?.stack ?? '') });
  }
}

function doPost(e) {
  if (!authorize_(e)) return unauthorized_();

  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(30000);
    locked = true;

    const body = parseBody_(e);
    const actionRaw = String(body.action || '').trim();
    const action = actionRaw.toLowerCase();

    // ★POSTでもpingできると便利
    if (action === 'ping') return json_({ ok: true, build: BUILD_ID, ts: Date.now() });

    if (action === 'season') return getSeason_();
    if (action === 'progress') return getProgress_({ parameter: { playerId: body.playerId } });

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
    if (action === 'cancel') return cancelEntry_(body);
    if (action === 'update') return updateEntry_(body);
    if (action === 'uploadlog') return uploadLog_(body);
    if (action === 'updateswisslog') return updateSwissLog_(body);

    return json_({
      ok: false,
      error: 'Unknown action',
      action: actionRaw,
      allowed: ['ping', 'season', 'login', 'raizanLogin', 'progress', 'append', 'cancel', 'update', 'uploadLog', 'updateSwissLog'],
    });

  } catch (err) {
    return json_({ ok:false, error:'Exception in doPost', message:String(err?.message ?? err), stack:String(err?.stack ?? '') });
  } finally {
    if (locked) try { lock.releaseLock(); } catch (_) {}
  }
}
