// src/app/services/discord-webhook.service.ts

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DiscordWebhookService {

  /**
   * Discord Webhook にメッセージを送る（部屋名の末尾3文字でWebhook先を判定）
   * @param roomName 投稿先の部屋名（末尾3文字を見て判別）
   * @param content  投稿内容（本文）※必須
   * @param logText  添付するテキストファイル(battle-log.txt)の中身（任意）
   * @param zipBlob  添付するZIPファイル(field-data.zip想定) の Blob（任意）
   */
  async postDiscord(
    roomName: string,
    content: string,
    logText?: string,
    zipBlob?: Blob
  ): Promise<void> {

    let webhookUrl = '';

    // ★ここで部屋名の末尾3文字をキーとして使う
    const key = roomName.slice(-3);

    switch (key) {

      case '雷の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934021866354528276/bxz1qWg1lBlNCH7U_qvdBZLbY2HbpANpvtGw7UmgtiTO_RsDr3NPqrPtFT-AFUvgz9sg';
        break;

      case '蛇の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022038086119434/ylgaxgDrmFAhDn7vtbWkQkNS5Un7NwH0yg2kkFtNoIQXRcoe8j82qwqDWLuS7MSEe8Nb';
        break;

      case '斬の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022159494414366/zosSOd9VOqhgah06yMYXnqIId80oNDE88xkwBHR-FXJG-qNLlbkA1z_1W1mGJWYx5wj_';
        break;

      case '陣の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022288339243008/v9owzP9LElsv7cz2ydPUbA5AD7FuESnVSG3hvmVLLSp_uAuoZppkTGh1muMFClqPVNcM';
        break;

      case '轟の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022423936921600/1ipX3jJP_y4swbS_94vL2VezQ32l0hN74uoiEnI97qMMFZLpX9ifPVfeFdqvuK5_BKa_';
        break;

      case '霧の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022561535234098/WIaszO61OzepiyldNBj_C8oOZLIJq5fbW2djqk0X2YCjFG2M23r8SboJyaKbqJgVc7io';
        break;

      case '瞬の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022678434697256/nfgebEvC-Opv0Mn0ZA7H44G_Cd-EE2INKiZawMKcWBSe-bjpnXhgUDlonFvZRydmj3NI';
        break;

      case '浄の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022788405166091/TnEfDK_uzQOgFWbtUqSVy8X-Z_ce336YNc1vjZ67VMPwv7S2l8Fce0jDujGJJmY4iiXp';
        break;

      case '滅の間':
        webhookUrl = 'https://discordapp.com/api/webhooks/934022912359399424/0StOpbSZJEzxXRz0FlrTd4ZQiMAneyqRTBQlYDEBi1XsopR6kTePKPkwWdgcQjjZQ-vT';
        break;

      // 「困りごと・質問」は末尾3文字が「・質問」になる想定
      case '・質問':
        webhookUrl = 'https://discordapp.com/api/webhooks/934395480958447636/4Fm0MHOUEo9Ez-mJr8EkfVoEGje5PisaQRJessA1SFZ8XfLl6gAG19JWt15cPMgLIsJj';
        break;

      default:
        throw new Error(`対応していない部屋名です: ${roomName} (key=${key})`);
    }

    // ------- 送信処理 -------

    // 何かしら添付がある場合（multipart/form-data）
    if (logText != null || zipBlob != null) {
      const form = new FormData();

      // メッセージ本体
      const payload = {
        content,
        username: roomName,
      };
      form.append('payload_json', JSON.stringify(payload));

      // 添付ファイルを配列にまとめてから一括で追加
      const files: { blob: Blob; filename: string }[] = [];

      if (zipBlob) {
        files.push({ blob: zipBlob, filename: 'field-data.zip' });
      }
      if (logText != null) {
        const txtBlob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
        files.push({ blob: txtBlob, filename: 'battle-log.txt' });
      }

      files.forEach((file, index) => {
        // Discordは files[0], files[1], ... 形式で複数添付を受け取れる
        form.append(`files[${index}]`, file.blob, file.filename);
      });

      const res = await fetch(webhookUrl, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Discord 送信失敗: ${res.status} ${res.statusText}`);
      }
      return;
    }

    // 添付なしの場合（application/json）
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: roomName,
      }),
    });

    if (!res.ok) {
      throw new Error(`Discord 送信失敗: ${res.status} ${res.statusText}`);
    }
  }
}
