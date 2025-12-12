// src/app/services/viewport-capture.service.ts

import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root',
})
export class ViewportCaptureService {

  /**
   * 現在ブラウザに表示されているページ内容を、そのままPNGとして保存する。
   * @param filename 保存ファイル名
   * @param delayMs  撮影前に待つ時間（ミリ秒）…人間が動ける程度なら 700〜1000ms くらい
   */
  async captureViewport(
    filename: string = 'udonarium-screen.png',
    delayMs: number = 800
  ): Promise<void> {

    // 撮影前に少し待つ（この間にメニューを閉じたり視点を調整できる）
    await this.delay(delayMs);

    const x = window.scrollX;
    const y = window.scrollY;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const canvas = await html2canvas(document.body, {
      x,
      y,
      width,
      height,
      scale: 2,              // 解像度アップ（お好みで）
      backgroundColor: null, // 不要なら '#000' など
    });

    canvas.toBlob(blob => {
      if (!blob) {
        alert('スクリーンショットの生成に失敗しました');
        return;
      }
      this.downloadBlob(blob, filename);
    });
  }

  // ---- 内部ユーティリティ ----

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
