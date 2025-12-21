import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ModalService } from 'service/modal.service';

export type TournamentDetailResult =
  | { action: 'CLOSE' }
  | { action: 'ENTRY'; tournamentId: string }
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
  status?: string;

  // 揺れ吸収（GAS/シート由来）
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

type ActionKind = 'ENTRY' | 'ENTERED' | 'ENTER' | 'RESULT' | null;

@Component({
  selector: 'app-raizan-tournament-detail-modal',
  templateUrl: './raizan-tournament-detail-modal.component.html',
  styleUrls: ['./raizan-tournament-detail-modal.component.css'],
})
export class RaizanTournamentDetailModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tournament: TournamentRow | null = null;
  @Input() isJoined = false;

  /** 表示用（必ず正規化済みの文字列） */
  venueAddressText = '';
  urlText = '';

  constructor(private modalService: ModalService) { }

  ngOnInit(): void {
    // ModalService が @Input 自動代入しない場合の保険
    if (!this.tournament) {
      const opt = this.readModalOption();
      if (opt?.tournament) this.tournament = opt.tournament as TournamentRow;
      if (typeof opt?.isJoined === 'boolean') this.isJoined = opt.isJoined;
    }
    this.normalizeTournament_();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.normalizeTournament_();
  }

  ngOnDestroy(): void { }

  private readModalOption(): any {
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
      if (c?.data?.tournament) return c.data;
      if (c?.params?.tournament) return c.params;
    }
    return null;
  }

  /** 空白だけ/ゼロ幅空白も “空” として扱う */
  private cleanText_(v: any): string {
    if (v === undefined || v === null) return '';
    return String(v)
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅空白系
      .trim();
  }

  private pickText_(...cands: any[]): string {
    for (const v of cands) {
      const s = this.cleanText_(v);
      if (s) return s;
    }
    return '';
  }

  /** 会場住所/URL を必ず表示できる形に正規化して保持 */
  private normalizeTournament_(): void {
    const t: any = this.tournament as any;
    if (!t) {
      this.venueAddressText = '';
      this.urlText = '';
      return;
    }

    // labels に入ってくる可能性がある場合の保険（他候補が全部空の時だけ使う）
    const labels = Array.isArray(t.labels) ? t.labels : [];
    const labelAddr = labels.length > 5 ? labels[5] : '';
    const labelUrl = labels.length > 15 ? labels[15] : '';

    const venueAddress = this.pickText_(
      t.venueAddress,
      t.VenueAddress,
      t.venue_address,
      t.venueaddress,
      t.address,
      labelAddr
    );

    const url = this.pickText_(
      t.url,
      t.URL,
      t.Url,
      t.uri,
      t.link,
      t.href,
      labelUrl
    );

    this.venueAddressText = venueAddress;
    this.urlText = url;

    // テンプレ反映を確実に（参照更新）
    this.tournament = { ...t, venueAddress, url } as TournamentRow;
  }

  close() {
    this.modalService.resolve({ action: 'CLOSE' } as TournamentDetailResult);
  }

  // ===== ボタン制御 =====

  private normStatus(): string {
    const s = String(this.tournament?.status || '').trim().toUpperCase();
    if (s === 'START') return 'OPEN';
    return s;
  }

  actionKind(): ActionKind {
    const st = this.normStatus();
    if (st === 'RECEPTION') return this.isJoined ? 'ENTERED' : 'ENTRY';
    if (st === 'OPEN') return 'ENTER';
    if (st === 'CLOSE') return 'RESULT';
    return null;
  }

  actionLabel(): string {
    const k = this.actionKind();
    if (k === 'ENTRY') return '大会にエントリーする';
    if (k === 'ENTERED') return '大会エントリー済';
    if (k === 'ENTER') return '大会に入場する';
    if (k === 'RESULT') return '大会結果';
    return '';
  }

  actionDisabled(): boolean {
    return this.actionKind() === 'ENTERED';
  }

  actionClass(): string {
    const k = this.actionKind();
    if (k === 'ENTRY') return 'entry';
    if (k === 'ENTERED') return 'entered';
    if (k === 'ENTER') return 'enter';
    if (k === 'RESULT') return 'result';
    return '';
  }

  onActionClick() {
    const tId = String(this.tournament?.tournamentId || '').trim();
    if (!tId) return;

    const k = this.actionKind();
    if (k === 'ENTRY') return this.modalService.resolve({ action: 'ENTRY', tournamentId: tId } as TournamentDetailResult);
    if (k === 'ENTER') return this.modalService.resolve({ action: 'ENTER', tournamentId: tId } as TournamentDetailResult);
    if (k === 'RESULT') return this.modalService.resolve({ action: 'RESULT', tournamentId: tId } as TournamentDetailResult);
  }

  // ===== 表示フォーマット =====

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
}
