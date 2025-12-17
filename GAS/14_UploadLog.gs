// 14_UploadLog.gs
function uploadLog_(body) {
  try {
    const fileName = String(body.fileName || '').trim();
    const base64 = String(body.base64 || '').trim();

    if (base64.length > 5000000) {
      return json_({ ok: false, error: 'payload too large', base64Length: base64.length });
    }
    if (!fileName) return json_({ ok: false, error: 'fileName is required' });
    if (!base64) return json_({ ok: false, error: 'base64 is required' });

    const folder = DriveApp.getFolderById(TOURNAMENT_LOG_FOLDER_ID);
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, 'application/zip', `${fileName}.zip`);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json_({ ok: true, fileId: file.getId(), url: file.getUrl(), name: file.getName() });
  } catch (err) {
    return json_({
      ok: false,
      error: 'Exception in uploadLog',
      message: String(err?.message ?? err),
      stack: String(err?.stack ?? ''),
    });
  }
}
