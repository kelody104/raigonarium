import { Injectable } from '@angular/core';

/** GAS(getTournaments_) が返す大会1行（大会詳細モーダルで使う分も含む） */
export type TournamentRow = {
  tournamentId: string;
  tournamentName: string;

  organizerName?: string;
  eventType?: string;

  eventVenue?: string;
  venueAddress?: string;

  receptionStartDate?: string;
  receptionEndDate?: string;
  tournamentStartDate?: string;
  tournamentEndDate?: string;

  capacity?: number;
  swissMaxRound?: number;
  bracketMaxRound?: number;

  topCutMethod?: string;
  topCut?: number;

  url?: string;
  status?: string;

  // 既存側が labels を参照していても壊れないように残す（使ってなければ無視でOK）
  labels?: string[];
};

export type EntryRow = {
  rowNumber: number;
  entryTime: string; // ISO
  tournamentId: string;
  playerId: string;
  playerName: string;
  items: string[]; // 20個
};

// --- 追加：スイス/トーナメント行（GASが返す形） ---
export type SwissMatchRow = {
  matchId: string;
  tournamentId: string;
  round: number;
  tableName: string;
  p1Id?: string;
  p2Id?: string;
  p1Wins?: number;
  p2Wins?: number;
  result: string; // 'NONE' | 'P1' | 'P2' | 'DRAW' | 'BYE' など
  logZipUrl?: string;
};

export type BracketMatchRow = {
  matchId: string;
  tournamentId: string;
  round: number;
  tableName: string;
  bestOf?: 1 | 3;

  p1Id?: string;
  p2Id?: string;
  result: string;
  logZipUrl?: string;

  // BO3（FINAL）
  p1GameWins?: number;
  p2GameWins?: number;
  game1Result?: string;
  game2Result?: string;
  game3Result?: string;
  game1LogZipUrl?: string;
  game2LogZipUrl?: string;
  game3LogZipUrl?: string;
};

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  private readonly baseUrl = 'https://mitarashi.link/api/sheet-proxy.php';
  private readonly token: string | null = null;

  /** 大会一覧（大会詳細モーダルで使う項目も全部持って返す） */
  async listTournaments(): Promise<TournamentRow[]> {
    const url = `${this.baseUrl}?action=tournaments&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`tournaments failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'tournaments error');

    const rows = (json.tournaments ?? json.rows ?? []) as any[];
    return rows.map(r => this.normalizeTournament_(r));
  }

  // 既存（playerId検索）
  async listEntriesByPlayerId(playerId: string, limit = 200): Promise<EntryRow[]> {
    const pid = (playerId || '').trim();
    if (!pid) return [];
    const url = `${this.baseUrl}?playerId=${encodeURIComponent(pid)}&limit=${encodeURIComponent(String(limit))}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`entries failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'entries error');
    return (json.rows || []) as EntryRow[];
  }

  // --- 追加：大会IDでEntry一覧 ---
  async listEntriesByTournamentId(tournamentId: string, limit = 500): Promise<EntryRow[]> {
    const tid = (tournamentId || '').trim();
    if (!tid) return [];
    const url = `${this.baseUrl}?action=entries&tournamentId=${encodeURIComponent(tid)}&limit=${encodeURIComponent(
      String(limit)
    )}&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`entries(tournament) failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'entries(tournament) error');
    return (json.rows || []) as EntryRow[];
  }

  // --- 追加：参加者IDでEntryを1件取得（入場チェック用） ---
  async getEntryById(tournamentId: string, entryId: string): Promise<EntryRow | undefined> {
    const tid = (tournamentId || '').trim();
    const id = (entryId || '').trim();
    if (!tid || !id) return undefined;

    const url = `${this.baseUrl}?action=entry&tournamentId=${encodeURIComponent(tid)}&entryId=${encodeURIComponent(
      id
    )}&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`entry failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'entry error');
    return (json.entry || undefined) as EntryRow | undefined;
  }

  // --- 追加：SwissMatches ---
  async listSwissMatches(tournamentId: string): Promise<SwissMatchRow[]> {
    const tid = (tournamentId || '').trim();
    if (!tid) return [];
    const url = `${this.baseUrl}?action=swiss&tournamentId=${encodeURIComponent(tid)}&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`swiss failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'swiss error');
    return (json.matches || json.rows || []) as SwissMatchRow[];
  }

  // --- 追加：BracketMatches ---
  async listBracketMatches(tournamentId: string): Promise<BracketMatchRow[]> {
    const tid = (tournamentId || '').trim();
    if (!tid) return [];
    const url = `${this.baseUrl}?action=bracket&tournamentId=${encodeURIComponent(tid)}&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`bracket failed: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'bracket error');
    return (json.matches || json.rows || []) as BracketMatchRow[];
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

    const text = await res.text();
    if (!res.ok) throw new Error(`post failed: ${res.status} ${text}`);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`post response is not JSON: ${text.slice(0, 200)}`);
    }
    if (!json.ok) throw new Error(json.error || 'post error');
  }

  /** 表記ゆれ吸収（保険） */
  // （ファイル全体の他の部分はそのまま）
  // normalizeTournament_ だけ差し替え版

  normalizeTournament_(raw: any): TournamentRow {
    const t: any = { ...(raw || {}) };

    const firstText = (...cands: any[]): string => {
      for (const v of cands) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (s) return s;
      }
      return '';
    };

    // 住所（trimして空白だけなら空扱い）
    t.venueAddress = firstText(t.venueAddress, t.VenueAddress, t.venue_address, t.venueaddress, t.address);

    // URL（trimして空白だけなら空扱い）
    t.url = firstText(t.url, t.URL, t.Url, t.uri, t.link, t.href);

    return t as TournamentRow;
  }
}
