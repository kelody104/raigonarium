import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { EntryRow, SheetApiService, TournamentRow } from 'service/sheet-api.service';

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
  specialnum1?: number;
  specialboo1?: boolean;
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
  tournaments: TournamentRow[] = [];

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

  private genPlayerId_(): string {
    const randInt = (maxExclusive: number): number => {
      // できれば crypto を使う（偏りが少ない）
      const g = (globalThis as any)?.crypto?.getRandomValues ? (globalThis as any).crypto : null;
      if (g) {
        const buf = new Uint32Array(1);
        g.getRandomValues(buf);
        return buf[0] % maxExclusive;
      }
      return Math.floor(Math.random() * maxExclusive);
    };

    const letter = String.fromCharCode(65 + randInt(26)); // A-Z
    const num = randInt(1000).toString().padStart(3, '0'); // 000-999
    return `${letter}${num}`;
  }

  debugOugi(p: OugiPiece, ev: Event): void {
    console.log('debugOugi fired:', p.id, p.name);
    ev.stopPropagation();
    this.toggleOugi(p);
  }

  onToggleOugiClick(ev: MouseEvent, p: OugiPiece): void {
    console.log("ggg");
    ev.preventDefault();
    ev.stopPropagation();
    p.specialboo1 = !p.specialboo1;

    // 差分検知対策（環境によって必要）
    this.ougiPieces = [...this.ougiPieces];
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
    this.clearOugiSelection_();
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
    this.syncOugiSelectionFromItems_(); // ←追加
  }

  onTournamentChanged(): void {
    // append時のみ：大会を変えたら入力欄をリセット（事故防止）
    if (this.edit.mode === 'append') {
      this.edit.items = Array.from({ length: 20 }, () => '');
      this.clearOugiSelection_(); // ←追加
    }
  }

  get selectedTournament(): TournamentRow | null {
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

  private clearOugiSelection_(): void {
    for (const p of this.ougiPieces) {
      p.specialboo1 = false;
    }
    this.selectedOugiIds = new Set<number>();
    this.ougiPieces = [...this.ougiPieces]; // 再描画
  }

  private syncOugiSelectionFromItems_(): void {
    // いったん全解除
    this.clearOugiSelection_();

    const t = this.selectedTournament;
    if (!t) return;

    const labels = Array.isArray(t.labels) ? t.labels : [];

    // 「奥義1〜6」になっている items の index を集める（順番も揃える）
    const ougiIdx = Array.from({ length: 20 }, (_, i) => {
      const label = String(labels[i] ?? '').trim();
      const m = label.match(/^奥義\s*([1-6])$/);
      return m ? { i, n: Number(m[1]) } : null;
    })
      .filter((x): x is { i: number; n: number } => x !== null)
      .sort((a, b) => a.n - b.n)
      .map(x => x.i);

    // items[奥義index] に入っている駒名の集合
    const names = new Set(
      ougiIdx
        .map(i => String(this.edit.items[i] ?? '').trim())
        .filter(s => !!s)
    );

    // 駒名一致したものを選択状態に
    for (const p of this.ougiPieces) {
      if (!(p.enabled ?? true)) continue;
      if (names.has(p.name)) {
        p.specialboo1 = true;
        this.selectedOugiIds.add(p.id); // （selectedOugiIds を使ってる箇所が残ってても破綻しないように）
      }
    }

    this.ougiPieces = [...this.ougiPieces]; // 再描画
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

    if (this.edit.mode === 'append' && !this.edit.playerId.trim()) {
      // 画面に反映されるよう edit にセット
      this.edit.playerId = this.genPlayerId_();
    }

    const tournamentId = this.edit.tournamentId.trim();
    if (!tournamentId) {
      this.error = '大会名（大会ID）は必須です';
      return;
    }

    const playerId = this.edit.playerId.trim();
    if (!playerId) {
      this.error = 'あなたの参加者IDは【' + this.edit.playerId + '】です。忘れないようにメモしてください。';
    }

    const playerName = this.edit.playerName.trim();
    if (!playerName) {
      this.error = 'プレイヤー名は必須です';
      return;
    }

    const items = this.ensure20_(this.edit.items);

    this.loading = true;
    try {
      if (this.selectedOugiPowerSum > 100) {
        throw new Error('必要陽力が100を超えています。');
      }

      if (this.edit.mode === 'append') {
        // ★ここを追加：奥義名を items（奥義1-6）へ反映
        await this.sheetApi.appendEntry(tournamentId, playerId, playerName, items);
        const ok = window.confirm('大会エントリーが完了しました。\nあなたの参加者IDは【' + playerId + '】です。\nエントリー内容を変更する場合は、このIDが必要になります。\n忘れないようにメモしてください。');
        if (!ok) return;
        this.filterId = playerId;   // ←登録したIDを検索欄に残す

        this.edit = this.newAppend_();
      } else {
        if (this.selectedOugiPowerSum > 100) {
          throw new Error('必要陽力が100を超えています。');
        }
        this.applySelectedOugiToItems_(items);
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
    return this.ougiPieces
      .filter(p => (p.enabled ?? true) && p.specialboo1)
      .reduce((sum, p) => sum + (Number(p.specialnum1) || 0), 0);
  }

  isOugiSelected(p: OugiPiece): boolean {
    return this.selectedOugiIds.has(p.id);
  }

  toggleOugi(p: OugiPiece): void {
    if (!(p.enabled ?? true)) return;
    p.specialboo1 = !p.specialboo1;
    this.ougiPieces = [...this.ougiPieces]; // ★再描画を確実に
  }


  trackByOugiId(_: number, p: OugiPiece): number {
    return p.id;
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
            specialboo1: Boolean(x.specialboo1),  // ★追加
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

  private applySelectedOugiToItems_(items: string[]): void {
    // 1) 選択中の奥義（specialboo1）を取得
    const selected = (this.ougiPieces ?? [])
      .filter(p => (p.enabled ?? true) && p.specialboo1)
      // 並び順は安定させる（必要陽力→id）
      .sort((a, b) => (Number(a.specialnum1) || 0) - (Number(b.specialnum1) || 0) || (a.id - b.id));

    if (selected.length > 6) {
      throw new Error('奥義は最大6つまで選択できます。');
    }

    const names = selected.map(p => p.name);

    // 2) items内の「奥義1-6」がどのindexか探す（大会ラベルから）
    const t = this.selectedTournament;
    const labels = Array.isArray(t?.labels) ? t!.labels : [];

    // idx[0] = 奥義1 の items index, idx[5] = 奥義6 の items index
    const idx: number[] = Array.from({ length: 6 }, () => -1);

    for (let i = 0; i < labels.length; i++) {
      const m = /^奥義\s*([1-6])$/.exec(String(labels[i] ?? '').trim());
      if (!m) continue;
      const n = Number(m[1]); // 1..6
      idx[n - 1] = i;
    }

    // 3) ラベルが無い大会の保険：先頭6項目に入れる
    const useFallback = idx.every(v => v < 0);
    const targetIdx = useFallback ? [0, 1, 2, 3, 4, 5] : idx;

    // 4) 代入（足りない分は空文字）
    for (let k = 0; k < 6; k++) {
      const i = targetIdx[k];
      if (i < 0) continue; // 奥義3だけ無い、などの大会でも落ちないように
      items[i] = names[k] ?? '';
    }
  }

  private ensure20_(items: any): string[] {
    const arr = Array.isArray(items) ? items : [];
    return Array.from({ length: 20 }, (_, i) => {
      const v = arr[i];
      return v === undefined || v === null ? '' : String(v);
    });
  }
}
