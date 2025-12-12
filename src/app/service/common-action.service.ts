import { Injectable } from '@angular/core';
import gameLayout from 'src/assets/json/game/game.json';

export type PlayerId = 'player1' | 'player2';
interface DrawPos {
  x: number;
  y: number;
}
export interface BoardPos {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

@Injectable({
  providedIn: 'root',   // ← これが「DI に登録」の意味
})
export class CommonActionService {

  static instance: CommonActionService;

  constructor(
    // 既存の DI はそのまま
    // private tabletopService: TabletopService, など
  ) {
    // ★ コンストラクタで自分自身を記録
    CommonActionService.instance = this;
  }

  /** 自分のビューのX回転（度）を保持しておく */
  private _viewRotateZ = 0;

  /** GameTable側から現在のviewRotateXをセットする用 */
  setViewRotateZ(angle: number) {
    // 0〜360 に正規化
    const norm = ((angle % 360) + 360) % 360;
    //console.log(norm);
    this._viewRotateZ = norm;
  }

  /** 現在のビューから player1 / player2 を判定 */
  getCurrentPlayer(): PlayerId {
    return this.getPlayerByViewRotate(this._viewRotateZ);
  }

  /** 現在プレイヤーの矢倉[列index] の 6マスぶんの座標を返す */
  getYaguraColumn(columnIndex: number): BoardPos[] {
    const player = this.getCurrentPlayer();
    const layout: any = gameLayout as any;
    const col = (layout[player]?.yagura ?? [])[columnIndex] ?? [];
    return col.map((c: any) => ({
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    }));
  }

  getTouColumn(columnIndex: number): BoardPos[] {
    const player = this.getCurrentPlayer();
    const layout: any = gameLayout as any;
    const col = (layout[player]?.tou ?? [])[columnIndex] ?? [];
    return col.map((c: any) => ({
      x: c.x,
      y: c.y,
      //width: c.width,
      //height: c.height,
    }));
  }

  /** 任意の角度から player1 / player2 を判定 */
  getPlayerByViewRotate(angle: number): PlayerId {
    const norm = ((angle % 360) + 360) % 360;
    if ((norm >= 0 && norm < 90) || (norm >= 270 && norm < 360)) {
      return 'player1';
    }
    return 'player2';
  }

  /** playerごとの draw[0..] 座標一覧を返す */
  getDrawPositions(player?: PlayerId): DrawPos[] {
    const p: PlayerId = player ?? this.getCurrentPlayer();
    const layout: any = gameLayout as any;
    const arr = layout[p]?.draw ?? [];
    return arr.map((d: any) => ({ x: d.x, y: d.y }));
  }

  /** 指定プレイヤーの draw[index] 1個だけを返す（なければ undefined） */
  getDrawPositionByIndex(index: number, player?: PlayerId): DrawPos | undefined {
    const posList = this.getDrawPositions(player);
    return posList[index];
  }

  getRandomvalue(from: number, to: number) {
    return Math.floor(Math.random() * to) + from;
  }

  getFamilyCode(PlayerCode: number) {
    switch (PlayerCode) {
      case 1:   // 空晴 太樹
      case 2:   // 空晴 天音
      case 6:   // 空晴 十梁
        return "kuze";
        break;
      case 9:   // 八雲 雹
      case 10:  // 八雲 茶々
        return "yakumo";
        break;
      case 8:   //雷藏 千歳
      case 12:  //雷藏 黒光
        return "rakura";
        break;
      case 3:   //飛雪 美琴
      case 5:   //飛雪 琳太郎
      case 11:  //飛雪 爽伍
        return "hisetsu";
        break;
      case 4:   //時雨 影助
      case 7:   //時雨 清十郎
        return "shigure";
        break;
      case 13: // 帳 神無羅
        return "tobari";
        break;
      default:
        return "viewer";
        break;
    }
    return "viewer";
  }
}
