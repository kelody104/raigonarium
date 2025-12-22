import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';

import { TournamentSheetService } from '../../service/tournament-sheet.service';
import { Entry, Tournament } from '../../models/tournament-models';

type PlayerInfo = {
  playerId: string;
  familyName: string;
  playerName: string;
  rank: string;
  rate: string;
};

type MatchVM = {
  kind: 'SWISS' | 'BRACKET';
  round: number;
  tableID: string;

  p1Id: string;
  p2Id: string;

  p1: PlayerInfo | null;
  p2: PlayerInfo | null;

  p1Wins: number;
  p2Wins: number;

  result: string;
  logZipUrl: string;
};

@Component({
  selector: 'app-tournament-board-modal',
  templateUrl: './tournament-board-modal.component.html',
  styleUrls: ['./tournament-board-modal.component.scss'],
})
export class TournamentBoardModalComponent {
  @Input() isOpen = false;
  @Input() tournament!: Tournament;
  @Input() mode: 'PLAYER' | 'WATCHER' = 'WATCHER';

  // ★これを追加（lobby/raizan-sato-modal から渡される）
  @Input() entry?: Entry;

  @Output() close = new EventEmitter<void>();
  @Output() enteredTable = new EventEmitter<void>();

  loading = false;
  error = '';

  matches: MatchVM[] = [];

  private loadingOnce = false;

  constructor(
    private sheet: TournamentSheetService
  ) { }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['isOpen']?.currentValue === true) {
      await this.onOpen();
    }
    if (changes['isOpen']?.currentValue === false) {
      this.loadingOnce = false;
    }
  }

  onCancel(): void {
    this.close.emit();
  }

  private async onOpen(): Promise<void> {
    if (!this.isOpen || !this.tournament) return;
    if (this.loading || this.loadingOnce) return;

    this.loadingOnce = true;
    this.loading = true;
    this.error = '';
    this.matches = [];

    try {
      const tid = this.tournament.tournamentId;

      const [swissMatches, bracketMatches] = await Promise.all([
        this.sheet.getSwissMatches(tid),
        this.sheet.getBracketMatches(tid),
      ]);

      // playerId一覧を作る
      const playerIds = new Set<string>();
      for (const m of [...(swissMatches ?? []), ...(bracketMatches ?? [])] as any[]) {
        const p1 = String(m?.p1Id ?? '').trim();
        const p2 = String(m?.p2Id ?? '').trim();
        if (p1) playerIds.add(p1);
        if (p2) playerIds.add(p2);
      }

      const playerMap = await this.loadPlayersMap_(Array.from(playerIds));

      const swissVM: MatchVM[] = (swissMatches ?? []).map((m: any) => {
        const p1Id = String(m?.p1Id ?? '').trim();
        const p2Id = String(m?.p2Id ?? '').trim();

        return {
          kind: 'SWISS',
          round: Number(m?.round ?? 0),
          tableID: String(m?.tableName ?? '').trim(),

          p1Id,
          p2Id,

          p1: playerMap.get(p1Id) ?? null,
          p2: playerMap.get(p2Id) ?? null,

          p1Wins: Number(m?.p1Wins ?? 0),
          p2Wins: Number(m?.p2Wins ?? 0),

          result: String(m?.result ?? '').trim(),
          logZipUrl: String(m?.logZipUrl ?? '').trim(),
        };
      });

      const bracketVM: MatchVM[] = (bracketMatches ?? []).map((m: any) => {
        const p1Id = String(m?.p1Id ?? '').trim();
        const p2Id = String(m?.p2Id ?? '').trim();

        // トーナメントは “p1GameWins/p2GameWins” を wins に寄せる（bestOf=1でも0/0になるだけ）
        const p1Wins = Number(m?.p1GameWins ?? 0);
        const p2Wins = Number(m?.p2GameWins ?? 0);

        return {
          kind: 'BRACKET',
          round: Number(m?.round ?? 0),
          tableID: String(m?.tableName ?? '').trim(),

          p1Id,
          p2Id,

          p1: playerMap.get(p1Id) ?? null,
          p2: playerMap.get(p2Id) ?? null,

          p1Wins,
          p2Wins,

          result: String(m?.result ?? '').trim(),
          logZipUrl: String(m?.logZipUrl ?? '').trim(),
        };
      });

      const all = [...swissVM, ...bracketVM]
        .filter(x => !!x.tableID)
        .sort((a, b) => {
          // 最新roundが上
          if (a.round !== b.round) return b.round - a.round;
          // 同roundはテーブルID昇順
          return a.tableID.localeCompare(b.tableID, 'en');
        });

      this.matches = all;
    } catch (e) {
      console.warn(e);
      this.error = '対戦卓の取得に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  trackByMatch(_: number, m: MatchVM) {
    return `${m.kind}-${m.round}-${m.tableID}`;
  }

  // =========================
  // Players 取得（存在すれば使う／なければ action=players を試す）
  // =========================
  private async loadPlayersMap_(ids: string[]): Promise<Map<string, PlayerInfo>> {
    const map = new Map<string, PlayerInfo>();
    if (!ids.length) return map;

    // 1) TournamentSheetService.getPlayers() があれば利用（型エラー回避のため any）
    try {
      const anySheet: any = this.sheet as any;
      if (typeof anySheet.getPlayers === 'function') {
        const rows = await anySheet.getPlayers();
        this.fillPlayersMap_(map, rows);
        return map;
      }
    } catch (e) {
      console.warn('[getPlayers()] failed', e);
    }

    // 2) service内の baseUrl/proxyUrl を推測して action=players を叩く
    try {
      const base = this.guessProxyUrl_();
      if (!base) return map;

      const candidates = [
        `${base}?action=players&limit=2000`,
        `${base}?action=getPlayers&limit=2000`,
      ];

      for (const url of candidates) {
        try {
          const r = await fetch(url);
          const j = await r.json();
          if (!j?.ok) continue;

          const rows = j.players ?? j.rows ?? [];
          this.fillPlayersMap_(map, rows);
          break;
        } catch (_) { }
      }
    } catch (e) {
      console.warn('[action=players] failed', e);
    }

    return map;
  }

  private fillPlayersMap_(map: Map<string, PlayerInfo>, rows: any[]) {
    if (!Array.isArray(rows)) return;

    for (const p of rows) {
      const playerId = String(p?.playerId ?? p?.id ?? '').trim();
      if (!playerId) continue;

      const familyName = String(p?.familyName ?? p?.family ?? '').trim();
      const playerName = String(p?.playerName ?? p?.name ?? '').trim();
      const rank = String(p?.rank ?? '').trim();
      const rate = String(p?.rate ?? '').trim();

      map.set(playerId, {
        playerId,
        familyName,
        playerName,
        rank,
        rate,
      });
    }
  }

  private guessProxyUrl_(): string {
    const anySheet: any = this.sheet as any;

    const candidates = [
      anySheet.sheetApiBaseUrl,
      anySheet.baseUrl,
      anySheet.proxyUrl,
      anySheet.apiBaseUrl,
      anySheet.endpoint,
    ];

    for (const c of candidates) {
      const s = String(c ?? '').trim();
      if (s.startsWith('http')) return s;
    }

    return '';
  }
}
