import { Injectable } from '@angular/core';

//export type RaizanRole = 'ADMIN' | 'MEMBER' | 'GUEST';

export interface RaizanMember {
  playerId: string;
  playerName: string;
  familyName: string;
  region: string;
  rank: string;
  //role: RaizanRole;
}

type SavedCredentials = {
  playerId: string;
  password: string;
  savedAt: number;
};

@Injectable({ providedIn: 'root' })
export class RaizanAuthService {
  private readonly endpoint = 'https://mitarashi.link/api/sheet-proxy.php';
  private readonly storageKey = 'raizanSatoCredentials';

  async login(playerId: string, password: string): Promise<any> {
    const res = await fetch('https://mitarashi.link/api/sheet-proxy.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'login', playerId, password }),
    });

    const text = await res.text();

    let obj: any;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error('ログイン応答がJSONではありません（sheet-proxy / GAS を確認してください）');
    }

    if (!obj.ok) {
      throw new Error(obj.error || obj.message || 'ログインに失敗しました');
    }

    // ★両対応：GASが member でも user でもOK
    const raw = obj.member ?? obj.user;

    // ★キー名ゆれも吸収（念のため）
    const member = raw ? {
      playerId: String(raw.playerId ?? raw.player_id ?? '').trim(),
      playerName: String(raw.playerName ?? raw.player_name ?? '').trim(),
      familyName: String(raw.familyName ?? raw.family_name ?? '').trim(),
      region: String(raw.region ?? '').trim(),
      rank: String(raw.rank ?? '').trim(),
      status: String(raw.status ?? '').trim(),
    } : null;

    if (!member?.playerId) {
      // デバッグしやすいように、返ってきた中身を出す
      console.error('login response payload:', obj);
      throw new Error('memberが不正です（GAS応答を確認）');
    }

    return member;
  }

  saveCredentials(playerId: string, password: string) {
    const data: SavedCredentials = { playerId, password, savedAt: Date.now() };
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  loadSavedCredentials(): { playerId: string; password: string } | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SavedCredentials;
      if (!data?.playerId || !data?.password) return null;
      return { playerId: data.playerId, password: data.password };
    } catch {
      return null;
    }
  }

  clearSavedCredentials() {
    localStorage.removeItem(this.storageKey);
  }
}
