// WebAppID: https://script.google.com/macros/s/AKfycbyY9haebkJHKVKeVmu1L1UtvNhlPNtEIcz9V20Ldza1wuZSBUh3aqQpZo5qMPAP0W4_HQ/exec
import { Injectable } from '@angular/core';

export type TournamentMaster = {
  tournamentId: string;
  tournamentName: string;
  labels: string[]; // 20個
};

export type EntryRow = {
  rowNumber: number;
  entryTime: string;     // ISO
  tournamentId: string;
  playerId: string;
  playerName: string;
  items: string[];       // 20個
};

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  // ★あなたのGAS WebアプリURLに差し替え
  private readonly baseUrl = 'https://mitarashi.link/api/sheet-proxy.php';

  // ★GAS側でトークンを有効にした場合だけ入れる（空なら無効）
  private readonly token: string | null = null;

async listTournaments(): Promise<TournamentMaster[]> {
  // ★必ず action を付ける
  const url = `${this.baseUrl}?action=tournaments&_=${Date.now()}`;

  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`tournaments failed: ${res.status}`);

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'tournaments error');

  // ★GASが旧挙動で rows を返すケースも吸収（保険）
  const list = (json.tournaments ?? json.rows ?? []) as TournamentMaster[];
  return list;
}

  async listEntriesByPlayerId(playerId: string, limit = 200): Promise<EntryRow[]> {
    const pid = (playerId || '').trim();
    if (!pid) return []; // 空なら0件（要求仕様）

    const url = `${this.baseUrl}?playerId=${encodeURIComponent(pid)}&limit=${encodeURIComponent(String(limit))}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`entries failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'entries error');
    return (json.rows || []) as EntryRow[];
  }

  async appendEntry(tournamentId: string, playerId: string, playerName: string, items: string[]): Promise<void> {
    await this.post_({
      action: 'append',
      token: this.token ?? undefined,
      tournamentId,
      playerId,
      playerName,
      items,
    });
  }

  async updateEntry(
    rowNumber: number,
    tournamentId: string,
    playerId: string,
    playerName: string,
    items: string[],
    entryTime?: string
  ): Promise<void> {
    await this.post_({
      action: 'update',
      token: this.token ?? undefined,
      rowNumber,
      tournamentId,
      playerId,
      playerName,
      items,
      entryTime: entryTime ?? undefined,
    });
  }

  private async post_(body: any): Promise<void> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    const text = await res.text(); // ★まず生で読む

    if (!res.ok) {
      // ★プロキシが返した JSON エラーもそのまま表示できる
      throw new Error(`post failed: ${res.status} ${text}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`post response is not JSON: ${text.slice(0, 200)}`);
    }

    if (!json.ok) throw new Error(json.error || 'post error');
  }
}
