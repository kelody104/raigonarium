import { Component, OnInit } from '@angular/core';
import { ModalService } from 'service/modal.service';
import { RaizanAuthService, RaizanMember } from 'service/raizan-auth.service';
import { RaizanProgressModalComponent } from 'component/raizan-progress-modal/raizan-progress-modal.component';
import { RaizanTournamentDetailModalComponent } from 'component/raizan-tournament-detail-modal/raizan-tournament-detail-modal.component';


export type RaizanSatoResult =
  | { action: 'CLOSE' }
  | { action: 'OPEN_TOURNAMENT_HALL'; member?: RaizanMember };

type TournamentRow = {
  tournamentId: string;
  tournamentName: string;
  organizerName?: string; // ★ organizerId → organizerName
  eventType?: string;
  url?: string;
  status?: string;

  // 詳細で使うなら入れておくと型が楽
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

  // ★追加：大会一覧
  tournaments: TournamentRow[] = [];
  groups: TournamentGroup[] = [];
  joinedTournamentIds = new Set<string>();
  isLoadingTournaments = false;
  tournamentError = '';

  constructor(
    private modalService: ModalService,
    private auth: RaizanAuthService
  ) { }

  ngOnInit(): void {
    this.tryAutoLogin();
    this.loadSeason();

    // ログイン不要でも大会一覧は見える想定
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

      // ★ログイン後：参加色を更新
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

    // ★ログアウト後：参加色は入力欄 playerId で判定（空なら全部通常色）
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

    // 既存データの揺れ吸収（画像に START があるので OPEN 扱いに寄せる）
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

    // 表示順（要件の5分類）
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
    // 参加色判定は「ログイン中なら member.playerId」「未ログインなら入力欄 playerId」
    const pid = String(this.member?.playerId ?? this.playerId ?? '').trim();
    return pid;
  }

  async loadTournamentsAndMarkJoined() {
    this.isLoadingTournaments = true;
    this.tournamentError = '';
    try {
      // 1) 大会一覧
      const tj = await this.fetchJson(`${this.sheetApiBaseUrl}?action=tournaments`);
      if (!tj.ok) throw new Error(tj.error || 'get tournaments failed');
      this.tournaments = (tj.tournaments ?? []) as TournamentRow[];

      // 2) 参加大会ID（entries から playerId で引く）
      this.joinedTournamentIds.clear();
      const pid = this.getCurrentPlayerIdForMark();
      if (pid) {
        const ej = await this.fetchJson(`${this.sheetApiBaseUrl}?action=entriesByPlayerId&playerId=${encodeURIComponent(pid)}&limit=1000`);
        if (ej.ok && Array.isArray(ej.rows)) {
          for (const row of ej.rows) {
            const tId = String(row?.tournamentId ?? '').trim();
            if (tId) this.joinedTournamentIds.add(tId);
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

async openTournamentDetail(t: any) {
  const width = 860;
  const height = 640;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;

  await this.modalService.open(
    RaizanTournamentDetailModalComponent,
    {
      tournament: { ...t },
      isJoined: this.isJoined(t),
      width, height, left, top
    }
  );
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
