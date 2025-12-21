import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ModalService } from 'service/modal.service';

export type TournamentDetailResult =
  | { action: 'CLOSE' }
  | { action: 'ENTER'; tournamentId: string }
  | { action: 'RESULT'; tournamentId: string };

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

  // status揺れ
  status?: string;
  tournamentStatus?: string;
  state?: string;
  phase?: string;

  // 揺れ吸収（シート/GAS由来）
  VenueAddress?: string;
  venue_address?: string;
  venueaddress?: string;
  address?: string;

  URL?: string;
  Url?: string;
  uri?: string;
  link?: string;
  href?: string;

  labels?: string[];
};

type ActionKind = 'BEFORE' | 'STANDBY' | 'ENTRY' | 'ENTERED' | 'ENTER' | 'RESULT';

@Component({
  selector: 'app-raizan-tournament-detail-modal',
  templateUrl: './raizan-tournament-detail-modal.component.html',
  styleUrls: ['./raizan-tournament-detail-modal.component.css'],
})
export class RaizanTournamentDetailModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tournament: TournamentRow | null = null;
  @Input() isJoined = false;

  @Input() width?: number;
  @Input() height?: number;
  @Input() left?: number;
  @Input() top?: number;

  venueAddressText = '';
  urlText = '';

  constructor(private modalService: ModalService) { }

  ngOnInit(): void {
    // ★Inputで来ない環境でも option から拾う
    this.hydrateFromModalOption_();
    this.normalizeTournament_();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.normalizeTournament_();
  }

  ngOnDestroy(): void { }

  close() {
    this.modalService.resolve({ action: 'CLOSE' } as TournamentDetailResult);
  }

  // ====== option 取得（ModalService実装差に対応） ======

  private hydrateFromModalOption_(): void {
    const opt = this.readModalOption_();
    if (!opt) return;

    const t = this.tournament as any;
    const looksEmpty =
      !t ||
      (typeof t === 'object' &&
        !String(t.tournamentId || '').trim() &&
        !String(t.tournamentName || '').trim());

    if (looksEmpty) {
      if (opt.tournament) this.tournament = opt.tournament as TournamentRow;
      else if (opt.data?.tournament) this.tournament = opt.data.tournament as TournamentRow;
      else if (opt.params?.tournament) this.tournament = opt.params.tournament as TournamentRow;
    }

    if (typeof opt.isJoined === 'boolean') this.isJoined = opt.isJoined;
    if (typeof opt.width === 'number') this.width = opt.width;
    if (typeof opt.height === 'number') this.height = opt.height;
    if (typeof opt.left === 'number') this.left = opt.left;
    if (typeof opt.top === 'number') this.top = opt.top;
  }

  private readModalOption_(): any {
    const ms: any = this.modalService as any;
    const candidates = [
      ms.option,
      ms.options,
      ms.modalOption,
      ms.modalOptions,
      ms.openOption,
      ms.openOptions,
      ms.data,
      ms.context,
      ms.params,
      ms.param,
      ms.currentOption,
    ].filter((x: any) => x && typeof x === 'object');

    for (const c of candidates) {
      if (c?.tournament) return c;
      if (c?.data?.tournament) return c;
      if (c?.params?.tournament) return c;
    }
    return null;
  }

  // ====== status に応じたボタン ======

  private normStatus(): string {
    const t: any = this.tournament || {};
    const raw0 = String(t.status ?? t.tournamentStatus ?? t.state ?? t.phase ?? '').trim().toUpperCase();

    if (!raw0) return 'ANNOUNCEMENT';
    if (raw0 === 'START') return 'OPEN';

    // ★追加：STAND-BY 揺れ吸収
    if (raw0 === 'STAND-BY' || raw0 === 'STANDBY' || raw0 === 'STAND_BY' || raw0 === 'STAND BY') {
      return 'STAND-BY';
    }

    return raw0;
  }

  actionKind(): ActionKind {
    const st = this.normStatus();

    if (st === 'ANNOUNCEMENT') return 'BEFORE';
    if (st === 'STAND-BY') return 'STANDBY'; // ★追加

    if (st === 'RECEPTION') return this.isJoined ? 'ENTERED' : 'ENTRY';
    if (st === 'OPEN') return 'ENTER';
    if (st === 'CLOSE') return 'RESULT';

    return 'BEFORE';
  }

  actionLabel(): string {
    const k = this.actionKind();
    if (k === 'BEFORE') return '受付前';
    if (k === 'STANDBY') return '受付終了'; // ★追加
    if (k === 'ENTRY') return 'エントリーする';
    if (k === 'ENTERED') return 'エントリー済';
    if (k === 'ENTER') return '入場する';
    if (k === 'RESULT') return '結果確認';
    return '';
  }

  actionDisabled(): boolean {
    const k = this.actionKind();
    return k === 'BEFORE' || k === 'ENTERED' || k === 'STANDBY'; // ★追加
  }

  onActionClick(): void {
    if (this.actionDisabled()) return;

    const k = this.actionKind();

    // RECEPTION 未エントリーは click処理空
    if (k === 'ENTRY') return;

    const tournamentId = String(this.tournament?.tournamentId || '').trim();
    if (!tournamentId) return;

    if (k === 'ENTER') {
      this.modalService.resolve({ action: 'ENTER', tournamentId } as TournamentDetailResult);
      return;
    }

    if (k === 'RESULT') {
      this.modalService.resolve({ action: 'RESULT', tournamentId } as TournamentDetailResult);
      return;
    }
  }

  // ====== 表示系 ======

  categoryLabel(): string {
    const v = String(this.tournament?.eventType || '').toUpperCase();
    if (v === 'HQ') return '本部';
    if (v === 'BR') return '支部';
    return '-';
  }

  formatStyle(): string {
    const s = Number(this.tournament?.swissMaxRound || 0);
    const b = Number(this.tournament?.bracketMaxRound || 0);
    return `スイスドロー ${s} 回戦 + トーナメント ${b} 回戦`;
  }

  topCutLabel(): string {
    const method = String(this.tournament?.topCutMethod || '').trim().toLowerCase();
    const cutRaw = this.tournament?.topCut;
    const cut = typeof cutRaw === 'number' && !isNaN(cutRaw) ? cutRaw : Number(cutRaw || 0);
    if (!cut || cut <= 0) return '-';
    if (method === 'rank') return `成績上位${cut}名`;
    if (method === 'wins') return `${cut}勝以上`;
    return `上位 ${cut}`;
  }

  formatDateRange(a?: string, b?: string): string {
    const fa = this.formatDateTime(a);
    const fb = this.formatDateTime(b);
    if (!fa && !fb) return '-';
    return `${fa || '-'} ～ ${fb || '-'}`;
  }

  private formatDateTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('ja-JP');
  }

  // ===== 会場住所/URL の正規化 =====

  private cleanText_(v: any): string {
    if (v === undefined || v === null) return '';
    return String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  private pickText_(...cands: any[]): string {
    for (const v of cands) {
      const s = this.cleanText_(v);
      if (s) return s;
    }
    return '';
  }

  private normalizeTournament_(): void {
    const t: any = this.tournament as any;
    if (!t) {
      this.venueAddressText = '';
      this.urlText = '';
      return;
    }

    const labels = Array.isArray(t.labels) ? t.labels : [];
    const labelAddr = labels.length > 5 ? labels[5] : '';
    const labelUrl = labels.length > 15 ? labels[15] : '';

    const venueAddress = this.pickText_(
      t.venueAddress, t.VenueAddress, t.venue_address, t.venueaddress, t.address, labelAddr
    );
    const url = this.pickText_(t.url, t.URL, t.Url, t.uri, t.link, t.href, labelUrl);

    this.venueAddressText = venueAddress;
    this.urlText = url;

    this.tournament = { ...t, venueAddress, url } as TournamentRow;
  }
}
