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
  @Input() ougiPieces: Piece[] = []; // 奥義

  @Output() save = new EventEmitter<{
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
  }>();

  @Output() close = new EventEmitter<void>();

  constructor(private tabletopActionService: TabletopActionService) { }
  /**
   * 雷神戦モードで「月に置く」を押したときに飛ばすイベント。
   * 実際に Card を作って tsuki に配置する処理は
   * 親コンポーネントやサービス側で実装してもらう想定。
   */
  @Output() placeToTsuki = new EventEmitter<{ ougiPieces: Piece[] }>();

  /** カウント選択用 (0〜8枚) */
  readonly countOptions: number[] = Array.from({ length: 9 }, (_, i) => i);

  /** 奥義検索用（読み） */
  ougiSearchTerm = '';

  /** 対戦モード */
  readonly battleModes: BattleMode[] = ['雷轟戦モード', '雷神戦モード'];
  selectedBattleMode: BattleMode = '雷神戦モード';

  ngOnInit(): void {
    // もとの配列を破壊しないようにクローンしつつ、enabled=false は除外
    this.otonashiPieces = this.cloneAndFilter(this.otonashiPieces);
    this.kotodamaPieces = this.cloneAndFilter(this.kotodamaPieces);
    this.ougiPieces = this.cloneAndFilter(this.ougiPieces);
  }

  private cloneAndFilter(pieces: Piece[]): Piece[] {
    return (pieces ?? [])
      .map(p => ({ ...(p as any) } as Piece))  // シンプルクローン
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
      // 雷轟戦モード: そのまま
      ougiForDeck = this.ougiPieces;
    }

    this.save.emit({
      otonashi: this.otonashiPieces,
      kotodama: this.kotodamaPieces,
      ougi: ougiForDeck,
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
    if (!term) {
      return this.ougiPieces;
    }

    const normalized = term.toLowerCase();

    return this.ougiPieces.filter((p: any) => {
      const yomi: string = (p.yomi ?? '') as string;
      return yomi.toLowerCase().includes(normalized);
    });
  }

  /**
   * 「月に置く」ボタン。
   * countInGame === 1 の奥義だけを集めて外に通知する。
   * ※実際に Card を作って tsuki に置く処理は呼び出し側に任せる。
   */
  onClickPlaceToTsuki(): void {
    if (this.selectedBattleMode !== '雷神戦モード') return;

    const ougiToPlace = this.ougiPieces.filter((p: any) => {
      return Number(p.countInGame ?? 0) === 1;
    });

    if (ougiToPlace.length === 0) {
      return;
    }

    // 月に置く先を親へ通知
    this.placeToTsuki.emit({ ougiPieces: ougiToPlace });

    // ★ 月に置いたらモーダルを閉じる
    this.close.emit();
  }

  Createkoma(name: string) {
    this.tabletopActionService.getCreateRaigokoma(name);
  }
}
