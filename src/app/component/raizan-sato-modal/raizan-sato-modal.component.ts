import { Component, OnInit } from '@angular/core';
import { ModalService } from 'service/modal.service';
import { RaizanAuthService, RaizanMember } from 'service/raizan-auth.service';
import { RaizanProgressModalComponent } from 'component/raizan-progress-modal/raizan-progress-modal.component';
import {
  RaizanTournamentDetailModalComponent,
  TournamentDetailResult
} from 'component/raizan-tournament-detail-modal/raizan-tournament-detail-modal.component';

import { Entry, Tournament } from '../../models/tournament-models';

export type RaizanSatoResult =
  | { action: 'CLOSE' }
  | { action: 'OPEN_TOURNAMENT_HALL'; member?: RaizanMember };

type TournamentRow = {
  tournamentId: string;
  tournamentName: string;
  organizerName?: string;
  eventType?: string;
  url?: string;
  status?: string;

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
};

type TournamentGroup = {
  key: 'OPEN' | 'STAND-BY' | 'RECEPTION' | 'ANNOUNCEMENT' | 'CLOSE';
  title: string;
  tournaments: TournamentRow[];
};

@Component({
  selector: 'app-raizan-sato-modal',
  templateUrl: './raizan-sato-modal.component.html',
  styleUrls: ['./raizan-sato-modal.component.css'],
})
export class RaizanSatoModalComponent implements OnInit {
  private readonly sheetApiBaseUrl = 'https://mitarashi.link/api/sheet-proxy.php';

  playerId = '';
  password = '';
  remember = true;

  isBusy = false;
  error = '';

  member: RaizanMember | null = null;
  season: number | null = null;

  tournaments: TournamentRow[] = [];
  groups: TournamentGroup[] = [];
  joinedTournamentIds = new Set<string>();
  isLoadingTournaments = false;
  tournamentError = '';

  // ★大会会場（tournament-board-modal）制御
  isTournamentBoardOpen = false;
  boardTournament: Tournament | null = null;
  boardMode: 'PLAYER' | 'WATCHER' = 'WATCHER';
  boardEntry?: Entry;

  constructor(
    private modalService: ModalService,
    private auth: RaizanAuthService
  ) { }

  ngOnInit(): void {
    this.tryAutoLogin();
    this.loadSeason();
    this.loadTournamentsAndMarkJoined();
  }

  private async tryAutoLogin() {
    const saved = this.auth.loadSavedCredentials();
    if (!saved) return;

    this.playerId = saved.playerId;
    this.password = saved.password;

    await this.login(true);
  }

  private async loadSeason() {
    try {
      const url = `${this.sheetApiBaseUrl}?action=season`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'getSeason failed');

      const n = Number(j.season);
      this.season = Number.isFinite(n) ? n : null;
    } catch (e) {
      console.warn('loadSeason failed', e);
      this.season = null;
    }
  }

  async login(isAuto = false) {
    this.error = '';
    this.isBusy = true;
    try {
      const m = await this.auth.login(this.playerId, this.password);
      this.member = m;

      if (this.remember) {
        this.auth.saveCredentials(this.playerId, this.password);
      } else {
        this.auth.clearSavedCredentials();
      }

      await this.loadTournamentsAndMarkJoined();
    } catch (e: any) {
      this.member = null;
      if (isAuto) this.auth.clearSavedCredentials();
      this.error = String(e?.message ?? e);
    } finally {
      this.isBusy = false;
    }
  }

  logout() {
    this.member = null;
    this.password = '';
    this.auth.clearSavedCredentials();
    this.loadTournamentsAndMarkJoined();
  }

  async openProgress(playerId?: string) {
    const pid = String(playerId ?? this.member?.playerId ?? '').trim();
    if (!pid) return;
    await this.modalService.open(RaizanProgressModalComponent, { playerId: pid });
  }

  // ====== 大会一覧 ======

  private normalizeStatus(s: string): TournamentGroup['key'] {
    const u = String(s || '').trim().toUpperCase();
    if (u === 'OPEN' || u === 'START') return 'OPEN';
    if (u === 'STAND-BY' || u === 'STANDBY' || u === 'STAND_BY') return 'STAND-BY';
    if (u === 'RECEPTION') return 'RECEPTION';
    if (u === 'ANNOUNCEMENT') return 'ANNOUNCEMENT';
    return 'CLOSE';
  }

  private buildGroups() {
    const buckets: Record<TournamentGroup['key'], TournamentRow[]> = {
      'OPEN': [],
      'STAND-BY': [],
      'RECEPTION': [],
      'ANNOUNCEMENT': [],
      'CLOSE': [],
    };

    for (const t of this.tournaments) {
      const key = this.normalizeStatus(t.status || '');
      buckets[key].push(t);
    }

    this.groups = [
      { key: 'OPEN', title: '開催中の大会', tournaments: buckets['OPEN'] },
      { key: 'RECEPTION', title: '受付中の大会', tournaments: buckets['RECEPTION'] },
      { key: 'STAND-BY', title: '受付終了の大会', tournaments: buckets['STAND-BY'] },
      { key: 'ANNOUNCEMENT', title: '受付前の大会', tournaments: buckets['ANNOUNCEMENT'] },
      { key: 'CLOSE', title: '終了した大会', tournaments: buckets['CLOSE'] },
    ];
  }

  private async fetchJson(url: string) {
    const r = await fetch(url);
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || 'invalid json');
    }
  }

  private getCurrentPlayerIdForMark(): string {
    return String(this.member?.playerId ?? this.playerId ?? '').trim();
  }

  async loadTournamentsAndMarkJoined() {
    this.isLoadingTournaments = true;
    this.tournamentError = '';
    try {
      const tj = await this.fetchJson(`${this.sheetApiBaseUrl}?action=tournaments`);
      if (!tj.ok) throw new Error(tj.error || 'get tournaments failed');
      this.tournaments = (tj.tournaments ?? []) as TournamentRow[];

      this.joinedTournamentIds.clear();
      const pid = this.getCurrentPlayerIdForMark();
      if (pid) {
        const ej = await this.fetchJson(
          `${this.sheetApiBaseUrl}?action=entriesByPlayerId&playerId=${encodeURIComponent(pid)}&limit=1000`
        );

        if (ej.ok && Array.isArray(ej.rows)) {
          for (const row of ej.rows) {
            const tId = String(row?.tournamentId ?? '').trim();
            if (!tId) continue;

            const role = String(row?.role ?? '').trim().toUpperCase();

            const aRaw = row?.active;
            const aStr = String(aRaw ?? '').trim().toUpperCase();
            // legacy：undefined/'' は true 扱い
            const isActive = (aRaw === true) || (aRaw == null) || (aStr === '' || aStr === 'TRUE' || aStr === '1');

            if (role === 'PLAYER' && isActive) {
              this.joinedTournamentIds.add(tId);
            }
          }
        }
      }

      this.buildGroups();
    } catch (e: any) {
      console.warn(e);
      this.tournamentError = String(e?.message ?? e);
      this.tournaments = [];
      this.groups = [];
      this.joinedTournamentIds.clear();
    } finally {
      this.isLoadingTournaments = false;
    }
  }

  isJoined(t: TournamentRow): boolean {
    return this.joinedTournamentIds.has(String(t.tournamentId || '').trim());
  }

  eventTypeLabel(t: TournamentRow): string {
    const v = String(t.eventType || '').toUpperCase();
    if (v === 'HQ') return '公式大会';
    if (v === 'BR') return '公認大会';
    return '';
  }

  // =========================
  // detail → board 遷移（ENTER/RESULT）
  // =========================
  async openTournamentDetail(t: TournamentRow) {
    const width = 860;
    const height = 640;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const pid = String(this.member?.playerId ?? '').trim();

    const res = await this.modalService.open(
      RaizanTournamentDetailModalComponent,
      {
        tournament: { ...t },
        isJoined: this.isJoined(t),
        playerId: pid,
        proxyUrl: this.sheetApiBaseUrl,
        width, height, left, top
      }
    ) as TournamentDetailResult | undefined;

    if (!res) return;

    if (res.action === 'ENTER' || res.action === 'RESULT') {
      this.openTournamentBoard(t);
    }
  }

  private openTournamentBoard(t: TournamentRow) {
    const tid = String(t.tournamentId ?? '').trim();
    const name = String(t.tournamentName ?? '').trim();
    if (!tid || !name) return;

    // ★Tournament型（必須プロパティを全部埋める）
    this.boardTournament = {
      tournamentId: tid,
      name,
      status: String(t.status ?? '').trim(),
      swissMaxRounds: Number(t.swissMaxRound ?? 0),
      topCut: Number(t.topCut ?? 0),
      bracketMaxRounds: Number(t.bracketMaxRound ?? 0),
    } as Tournament;

    const joined = this.isJoined(t) && !!this.member?.playerId;
    this.boardMode = joined ? 'PLAYER' : 'WATCHER';

    // ★Entry型（必須プロパティを全部埋める）
    if (joined) {
      const pid = String(this.member!.playerId).trim();
      this.boardEntry = {
        entryId: `E_${tid}_${pid}`,
        tournamentId: tid,
        playerId: pid,
        role: 'PLAYER',
        active: true,
      } as Entry;
    } else {
      this.boardEntry = undefined;
    }

    this.isTournamentBoardOpen = true;
  }

  onTournamentBoardClose() {
    this.isTournamentBoardOpen = false;
    this.boardTournament = null;
    this.boardEntry = undefined;
    this.boardMode = 'WATCHER';
  }

  onEnteredTableFromBoard() {
    // board で入室したら里モーダルは閉じる
    this.close();
  }

  // ====== 既存 ======

  goTournamentHall() {
    const result: RaizanSatoResult = { action: 'OPEN_TOURNAMENT_HALL', member: this.member ?? undefined };
    this.modalService.resolve(result);
  }

  goTournamentHallWithoutLogin() {
    const result: RaizanSatoResult = { action: 'OPEN_TOURNAMENT_HALL' };
    this.modalService.resolve(result);
  }

  close() {
    const result: RaizanSatoResult = { action: 'CLOSE' };
    this.modalService.resolve(result);
  }
}
