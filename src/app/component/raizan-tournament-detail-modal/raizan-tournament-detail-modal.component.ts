import { Component, Input, OnInit } from '@angular/core';
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
};

type ActionKind = 'ENTRY' | 'ENTERED' | 'ENTER' | 'RESULT' | null;

@Component({
  selector: 'app-raizan-tournament-detail-modal',
  templateUrl: './raizan-tournament-detail-modal.component.html',
  styleUrls: ['./raizan-tournament-detail-modal.component.css'],
})
export class RaizanTournamentDetailModalComponent implements OnInit {
  @Input() tournament: TournamentRow | null = null;
  @Input() isJoined = false;

  constructor(private modalService: ModalService) { }

  ngOnInit(): void {
    // ModalService が @Input 自動代入しない場合の保険（前回と同様）
    if (!this.tournament) {
      const opt = this.readModalOption();
      if (opt?.tournament) this.tournament = opt.tournament as TournamentRow;
      if (typeof opt?.isJoined === 'boolean') this.isJoined = opt.isJoined;
    }
  }

  private readModalOption(): any {
    const ms: any = this.modalService as any;
    const candidates = [
      ms.option, ms.options, ms.modalOption, ms.modalOptions, ms.openOption, ms.openOptions,
      ms.data, ms.context, ms.params, ms.param, ms.currentOption,
    ].filter(x => x && typeof x === 'object');

    for (const c of candidates) {
      if (c?.tournament) return c;
      if (c?.data?.tournament) return c.data;
      if (c?.params?.tournament) return c.params;
    }
    return null;
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
    return null; // ANNOUNCEMENT/STAND-BY などは非表示
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

  // ✅ ③ 足切りライン文言
  topCutLabel(): string {
    const method = String(this.tournament?.topCutMethod || '').trim().toLowerCase();
    const cutRaw = this.tournament?.topCut;

    const cut = (typeof cutRaw === 'number' && !isNaN(cutRaw)) ? cutRaw : Number(cutRaw || 0);
    if (!cut || cut <= 0) return '-';

    if (method === 'rank') return `成績上位${cut}名`;
    if (method === 'wins') return `${cut}勝以上`;

    // 保険（未知）
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

  mapsUrl(address?: string): string {
    const a = String(address || '').trim();
    if (!a) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
  }

  normalizedUrl(url?: string): string {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
  }
}
