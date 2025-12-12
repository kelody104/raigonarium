import { Component, Input } from '@angular/core';
import { GorgeService, Rect, PlayerKey } from 'service/gorge.service';
import { CommonActionService } from 'service/common-action.service'; // 先頭にこれを追加

@Component({
  selector: 'app-gorge-board',
  templateUrl: './gorge-board.component.html',
  styleUrls: ['./gorge-board.component.css'],
})
export class GorgeBoardComponent {

  /** どちら側の峡谷を表示するか（player1 / player2） */
  @Input() player: PlayerKey = 'player1';

  /** ドラッグ中フラグ（マスク表示用） */
  hover$ = this.gorge.hover$;

  /** 駒の並び順（15 種） */
  names = ['雷', '蛇', '斬', '陣', '一', '二', '三', '四', '轟', '霧', '瞬', '浄', '五', '六', '七'];

  constructor(public gorge: GorgeService) { }

  /** 自分の峡谷の矩形（テンプレートから使用） */
  get rect(): Rect | null {
    return this.gorge.getRect(this.player);
  }

  /** 通常駒の枚数 */
  getCount(name: string): number {
    return this.gorge.getCount(name, this.player);
  }

  /** 奥義スロットに表示する名前（あれば） */
  get ougiName(): string | null {
    return this.gorge.getOugiName(this.player);
  }

  /** 奥義の枚数 */
  get ougiCount(): number {
    return this.gorge.getOugiCount(this.player);
  }

  /** 通常駒アイコンのダブルクリックで 1 枚取り出す */
  onPieceDblClick(name: string): void {
    this.gorge.takeOne(name, this.player);
  }

  /** 奥義アイコンのダブルクリックで 1 枚取り出す */
  onOugiDblClick(): void {
    this.gorge.takeOugi(this.player);
  }

  /** ★ 今の視点が player2 かどうか（マスクの向き用） */
  get isPlayer2View(): boolean {
    const common = CommonActionService.instance;
    if (!common) return false;
    return common.getCurrentPlayer() === 'player2';
  }
}
