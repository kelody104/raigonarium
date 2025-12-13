// src/app/component/raizan-settings-modal/raizan-settings-modal.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Piece } from 'models/piece';
import { TabletopActionService } from 'src/app/service/tabletop-action.service';

type BattleMode = '雷轟戦モード' | '雷神戦モード';

@Component({
  selector: 'app-raizan-settings-modal',
  templateUrl: './raizan-settings-modal.component.html',
  styleUrls: ['./raizan-settings-modal.component.scss'],
})
export class RaizanSettingsModalComponent implements OnInit {

  @Input() otonashiPieces: Piece[] = [];
  @Input() kotodamaPieces: Piece[] = [];
  @Input() ougiPieces: Piece[] = [];

  @Output() save = new EventEmitter<{
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
    battleMode: BattleMode;
    useGora: boolean;
  }>();

  @Output() close = new EventEmitter<void>();

  /** 雷神戦モードで「月に置く」を押したときに飛ばすイベント */
  @Output() placeToTsuki = new EventEmitter<{ ougiPieces: Piece[] }>();

  /** カウント選択用 (0〜8枚) */
  readonly countOptions: number[] = Array.from({ length: 9 }, (_, i) => i);

  /** 奥義検索用（読み） */
  ougiSearchTerm = '';

  /** 対戦モード */
  readonly battleModes: BattleMode[] = ['雷轟戦モード', '雷神戦モード'];
  selectedBattleMode: BattleMode = '雷轟戦モード';

  /** 豪雷を使用する */
  useGora = false;

  constructor(private tabletopActionService: TabletopActionService) { }

  ngOnInit(): void {
    // もとの配列を破壊しないようにクローンしつつ、enabled=false は除外
    this.otonashiPieces = this.cloneAndFilter(this.otonashiPieces);
    this.kotodamaPieces = this.cloneAndFilter(this.kotodamaPieces);
    this.ougiPieces = this.cloneAndFilter(this.ougiPieces);
  }

  private cloneAndFilter(pieces: Piece[]): Piece[] {
    return (pieces ?? [])
      .map(p => ({ ...(p as any) } as Piece))
      .filter((p: any) => p.enabled !== false);
  }

  /** 枚数変更（音無／言霊／奥義共通） */
  onChangeCount(piece: Piece, value: number | string): void {
    (piece as any).countInGame = Number(value);
  }

  /** 奥義を 0 ↔ 1 でトグル（クリックで ON/OFF） */
  toggleOugi(piece: Piece): void {
    const current = Number((piece as any).countInGame ?? 0);
    (piece as any).countInGame = current === 1 ? 0 : 1;
  }

  /** 「雷山生成」ボタン */
  onClickSave(): void {
    let ougiForDeck: Piece[];

    if (this.selectedBattleMode === '雷神戦モード') {
      // 雷神戦モード: 雷山には奥義を含めない → 全て countInGame=0 にしたクローンを渡す
      ougiForDeck = this.ougiPieces.map(p => {
        const clone: any = { ...(p as any) };
        clone.countInGame = 0;
        return clone as Piece;
      });
    } else {
      ougiForDeck = this.ougiPieces;
    }

    this.save.emit({
      otonashi: this.otonashiPieces,
      kotodama: this.kotodamaPieces,
      ougi: ougiForDeck,
      battleMode: this.selectedBattleMode,
      useGora: this.useGora,
    });

    this.close.emit();
  }

  onClickClose(): void {
    this.close.emit();
  }

  onClickBackdrop(): void {
    this.close.emit();
  }

  /** 奥義の検索結果（読みでフィルタ） */
  get filteredOugiPieces(): Piece[] {
    const term = this.ougiSearchTerm.trim();
    if (!term) return this.ougiPieces;

    const normalized = term.toLowerCase();
    return this.ougiPieces.filter((p: any) => {
      const yomi: string = String(p.yomi ?? '');
      return yomi.toLowerCase().includes(normalized);
    });
  }

  /** 「月に置く」ボタン：countInGame === 1 の奥義だけ通知 */
  onClickPlaceToTsuki(): void {
/*    if (this.selectedBattleMode !== '雷神戦モード') return;*/

    const ougiToPlace = this.ougiPieces.filter((p: any) => Number(p.countInGame ?? 0) === 1);
    if (ougiToPlace.length === 0) return;

    this.placeToTsuki.emit({ ougiPieces: ougiToPlace });
    this.close.emit();
  }

  /** 駒を1枚生成（テスト用） */
  Createkoma(piece: Piece): void {
    this.tabletopActionService.getCreateRaigokoma(piece);
  }
}
