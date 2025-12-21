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

type ActionKind = 'BEFORE' | 'STANDBY' | 'ENTRY' | 'CANCEL' | 'ENTER' | 'RESULT';

type AppendEntryResponse = {
  ok: boolean;
  entryId?: string;
  existed?: boolean;
  error?: string;
  message?: string;
};

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

  private actionBusy = false;

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
    if (st === 'STAND-BY') return 'STANDBY';

    if (st === 'RECEPTION') return this.isJoined ? 'CANCEL' : 'ENTRY';
    if (st === 'OPEN') return 'ENTER';
    if (st === 'CLOSE') return 'RESULT';

    return 'BEFORE';
  }

  actionLabel(): string {
    const k = this.actionKind();
    if (k === 'BEFORE') return '大会受付前';
    if (k === 'STANDBY') return '受付終了';
    if (k === 'ENTRY') return this.actionBusy ? 'エントリー中…' : '大会にエントリーする';
    if (k === 'CANCEL') return this.actionBusy ? '取消中…' : 'エントリーを取り消す';
    if (k === 'ENTER') return '入場';
    if (k === 'RESULT') return '結果確認';
    return '';
  }

  actionDisabled(): boolean {
    if (this.actionBusy) return true;
    const k = this.actionKind();
    return k === 'BEFORE' || k === 'STANDBY'; // ★CANCEL は押せる
  }

  onActionClick(): void {
    if (this.actionDisabled()) return;

    const k = this.actionKind();
    if (k === 'ENTRY') { void this.appendEntry_(); return; }
    if (k === 'CANCEL') { void this.cancelEntry_(); return; }

    const tournamentId = String(this.tournament?.tournamentId || '').trim();
    if (!tournamentId) return;

    if (k === 'ENTER') this.modalService.resolve({ action: 'ENTER', tournamentId });
    if (k === 'RESULT') this.modalService.resolve({ action: 'RESULT', tournamentId });
  }

  // ====== エントリー処理 ======

  private getPlayerId_(): string {
    const opt = this.readModalOption_();

    // 1) Modal option 由来（推奨：open時に渡す）
    const p1 = this.pickText_(opt?.playerId, opt?.data?.playerId, opt?.params?.playerId);
    if (p1) return p1;

    // 2) window グローバル（プロジェクト側で置いてる場合）
    const w: any = window as any;
    const p2 = this.pickText_(w?.raizanPlayerId, w?.RAIZAN_PLAYER_ID, w?.raizan?.playerId, w?.app?.playerId);
    if (p2) return p2;

    // 3) localStorage（ログイン後に保存している場合）
    try {
      const keys = [
        'playerId',
        'raizanPlayerId',
        'raizan.playerId',
        'RAIZAN_PLAYER_ID',
        'raizan_login_playerId',
      ];
      for (const k of keys) {
        const v = this.cleanText_(localStorage.getItem(k));
        if (v) return v;
      }
    } catch (_) { }

    return '';
  }

  // エントリー取消
  private async cancelEntry_(): Promise<void> {
    const tournamentId = this.cleanText_(this.tournament?.tournamentId);
    const playerId = this.getPlayerId_();

    if (!tournamentId) { alert('tournamentId が取得できませんでした。'); return; }
    if (!playerId) { alert('playerId が取得できませんでした（ログイン状態を確認してください）。'); return; }

    if (!confirm('エントリーを取り消しますか？')) return;

    this.actionBusy = true;
    try {
      const payload = { action: 'cancel', tournamentId, playerId };
      console.log('[cancelEntry request]', payload);

      const resp = await this.postJson_(payload);
      console.log('[cancelEntry response]', resp);

      if (!resp || resp.ok !== true) {
        const lines: string[] = [];
        lines.push('取消に失敗しました');
        lines.push(`error: ${resp?.error ?? 'unknown'}`);
        if (resp?.message) lines.push(`message: ${resp.message}`);
        if (resp?.stack) console.error('[GAS stack]', resp.stack);
        alert(lines.join('\n'));
        return;
      }

      this.isJoined = false;
    } finally {
      this.actionBusy = false;
    }
  }

  private proxyUrl_(): string {
    const opt = this.readModalOption_();
    const fromOpt = this.pickText_(opt?.proxyUrl, opt?.sheetApiBaseUrl, opt?.baseUrl);
    if (fromOpt) return fromOpt;

    const w: any = window as any;
    return String(w?.SHEET_PROXY_URL || w?.RAIZAN_SHEET_PROXY_URL || 'https://mitarashi.link/api/sheet-proxy.php');
  }

  private async postJson_(payload: any): Promise<any> {
    const res = await fetch(this.proxyUrl_(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: 'invalid_json', message: text };
    }
  }

  private async appendEntry_(): Promise<void> {
    const tournamentId = this.cleanText_(this.tournament?.tournamentId);
    const playerId = this.getPlayerId_();

    if (!tournamentId) {
      alert('tournamentId が取得できませんでした。');
      return;
    }
    if (!playerId) {
      alert('playerId が取得できませんでした（ログイン状態を確認してください）。');
      return;
    }

    this.actionBusy = true;
    try {
      const payload = {
        action: 'append',
        tournamentId,
        playerId,
        role: 'PLAYER',
        active: true,
      };
      console.log('[appendEntry request]', payload);

      const resp = await this.postJson_(payload);
      console.log('[appendEntry response]', resp);

      if (!resp || resp.ok !== true) {
        const lines: string[] = [];
        lines.push('エントリーに失敗しました');

        // GAS/doPost側のエラーコード
        lines.push(`error: ${resp?.error ?? 'unknown'}`);

        // doPost catchで返している message を見たい
        if (resp?.message) lines.push(`message: ${resp.message}`);

        // 画面は長くなるので stack は console に出すのがおすすめ
        if (resp?.stack) {
          console.error('[GAS stack]', resp.stack);
        }

        console.error('[appendEntry response]', resp);
        alert(lines.join('\n'));
        return;
      }


      // 成功（既に存在でもOK扱い）
      this.isJoined = true;
    } catch (e: any) {
      alert(`エントリー中に例外が発生しました: ${String(e?.message ?? e)}`);
    } finally {
      this.actionBusy = false;
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
