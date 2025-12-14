import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { EntryRow, SheetApiService, TournamentMaster } from 'service/sheet-api.service';

type EditModel = {
  mode: 'append' | 'update';
  rowNumber: number | null;

  tournamentId: string; // ★大会
  playerId: string;     // ★検索・入力ID
  playerName: string;

  // entryTimeは保持だけ（表示/編集しない）
  entryTime: string;

  items: string[];      // 20個
};

type OugiPiece = {
  id: number;
  name: string;
  enabled?: boolean;
  specialnum1: number;
};

type OugiGroup = {
  power: number;
  pieces: OugiPiece[];
};


@Component({
  selector: 'app-sheet-editor-modal',
  templateUrl: './sheet-editor-modal.component.html',
  styleUrls: ['./sheet-editor-modal.component.scss'],
})
export class SheetEditorModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  loading = false;
  error = '';

  // 検索
  filterId = '';
  limit = 50;

  // マスタ
  tournaments: TournamentMaster[] = [];

  // 結果
  rows: EntryRow[] = [];

  edit: EditModel = this.newAppend_();

  ougiPieces: OugiPiece[] = [];
  readonly ougiPowerGroups: number[] = [15, 17, 34, 51];
  selectedOugiIds = new Set<number>(); // ★ private を外して再代入できるように

  constructor(private sheetApi: SheetApiService) { }

  async ngOnInit(): Promise<void> {
    await this.refreshTournaments();
    await this.loadOugi_();
  }

  onClickClose(): void {
    this.close.emit();
  }

  onClickBackdrop(): void {
    this.close.emit();
  }

  async refreshTournaments(): Promise<void> {
    this.error = '';
    this.loading = true;
    try {
      const masters = await this.sheetApi.listTournaments();
      this.tournaments = masters;
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.loading = false;
    }
  }

  onToggleOugiClick(ev: MouseEvent, p: OugiPiece): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.toggleOugi(p);
  }

  async onClickSearch(): Promise<void> {
    this.error = '';
    const pid = this.filterId.trim();

    // 仕様：空なら何も出さない
    if (!pid) {
      this.rows = [];
      return;
    }

    this.loading = true;
    try {
      const rows = await this.sheetApi.listEntriesByPlayerId(pid, this.limit);
      // 見やすく新しい順（rowNumberが大きい方が新しい想定）
      this.rows = rows.slice().sort((a, b) => b.rowNumber - a.rowNumber);
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.loading = false;
    }
  }

  onClickNew(): void {
    this.edit = this.newAppend_();
  }

  selectRow(r: EntryRow): void {
    this.edit = {
      mode: 'update',
      rowNumber: r.rowNumber,
      tournamentId: r.tournamentId || '',
      playerId: r.playerId || '',
      playerName: r.playerName || '',
      entryTime: r.entryTime || '',
      items: this.ensure20_(r.items),
    };
  }

  onTournamentChanged(): void {
    // append時のみ：大会を変えたら入力欄をリセット（事故防止）
    if (this.edit.mode === 'append') {
      this.edit.items = Array.from({ length: 20 }, () => '');
    }
  }

  get selectedTournament(): TournamentMaster | null {
    const id = this.edit.tournamentId;
    if (!id) return null;
    return this.tournaments.find(t => t.tournamentId === id) ?? null;
  }

  get visibleItemIndices(): number[] {
    const t = this.selectedTournament;
    if (!t) return [];
    const labels = Array.isArray(t.labels) ? t.labels : [];
    const out: number[] = [];
    for (let i = 0; i < 20; i++) {
      const label = (labels[i] ?? '').trim();
      if (label && !this.isOugiFieldLabel_(label)) out.push(i);
    }
    return out;
  }

  private isOugiFieldLabel_(label: string): boolean {
    const s = String(label || '').trim();
    return /^奥義\s*[1-6]$/.test(s);
  }

  labelOf(i: number): string {
    const t = this.selectedTournament;
    const label = t?.labels?.[i] ?? '';
    return String(label || '').trim();
  }

  tournamentNameOf(id: string): string {
    const t = this.tournaments.find(x => x.tournamentId === id);
    return t ? t.tournamentName : id;
  }

  async onClickSave(): Promise<void> {
    this.error = '';

    const tournamentId = this.edit.tournamentId.trim();
    if (!tournamentId) {
      this.error = '大会名（大会ID）は必須です';
      return;
    }

    const playerId = this.edit.playerId.trim();
    if (!playerId) {
      this.error = 'IDは必須です';
      return;
    }

    const playerName = this.edit.playerName.trim();
    if (!playerName) {
      this.error = 'プレイヤー名は必須です';
      return;
    }

    const items = this.ensure20_(this.edit.items);

    this.loading = true;
    try {
      if (this.edit.mode === 'append') {
        await this.sheetApi.appendEntry(tournamentId, playerId, playerName, items);
        this.edit = this.newAppend_();
      } else {
        if (!this.edit.rowNumber) throw new Error('rowNumber がありません');
        await this.sheetApi.updateEntry(this.edit.rowNumber, tournamentId, playerId, playerName, items, this.edit.entryTime || undefined);
      }
      // 直近の検索条件で再表示（空なら0件）
      await this.onClickSearch();
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.loading = false;
    }
  }

  // 入力バグ防止（trackBy＋standaloneで安定させる）
  trackByIndex(index: number): number {
    return index;
  }

  private newAppend_(): EditModel {
    return {
      mode: 'append',
      rowNumber: null,
      tournamentId: '',
      playerId: '',
      playerName: '',
      entryTime: '',
      items: Array.from({ length: 20 }, () => ''),
    };
  }

  get ougiGroups(): OugiGroup[] {
    const list = this.ougiPieces ?? [];
    return this.ougiPowerGroups.map(power => ({
      power,
      pieces: list.filter(p => Number(p.specialnum1) === power),
    }));
  }

  get selectedOugiPowerSum(): number {
    let sum = 0;
    for (const p of this.ougiPieces) {
      if (this.selectedOugiIds.has(p.id)) sum += Number(p.specialnum1 || 0);
    }
    return sum;
  }

  isOugiSelected(p: OugiPiece): boolean {
    return this.selectedOugiIds.has(p.id);
  }

  toggleOugi(p: OugiPiece): void {
    if (this.selectedOugiIds.has(p.id)) this.selectedOugiIds.delete(p.id);
    else this.selectedOugiIds.add(p.id);

    // ★差分検知を確実にする（環境や最適化設定でも効く）
    this.selectedOugiIds = new Set(this.selectedOugiIds);
  }

  ougiImgSrc(p: OugiPiece): string {
    return `assets/images/raigo/koma/${p.name}.jpg`;
  }

  private async loadOugi_(): Promise<void> {
    if (this.ougiPieces.length > 0) return;

    const candidates = [
      'assets/json/koma/ougi.json',
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'no-store' as RequestCache });
        if (!res.ok) continue;

        const json = await res.json();
        if (!Array.isArray(json)) continue;

        this.ougiPieces = (json as any[])
          .filter(x => x && x.enabled !== false)
          .map(x => ({
            id: Number(x.id),
            name: String(x.name ?? ''),
            specialnum1: Number(x.specialnum1 ?? 0),
            enabled: x.enabled !== false,
          }))
          .filter(x => Number.isFinite(x.id) && x.id > 0 && x.name && Number.isFinite(x.specialnum1));

        return;
      } catch {
        // 次候補へ
      }
    }

    // 読めない場合はUIにだけ出す（既存の error 表示を流用）
    if (!this.error) this.error = 'ougi.json の読み込みに失敗しました（assets 配下に配置してください）';
  }

  private ensure20_(items: any): string[] {
    const arr = Array.isArray(items) ? items : [];
    return Array.from({ length: 20 }, (_, i) => {
      const v = arr[i];
      return v === undefined || v === null ? '' : String(v);
    });
  }
}
