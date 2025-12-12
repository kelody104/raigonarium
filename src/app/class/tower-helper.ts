// src/app/class/raigo/tower-helper.ts などに配置

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Card, CardState } from 'src/app/class/card';
import { CardStack } from 'src/app/class/card-stack';
import { CommonActionService } from 'service/common-action.service';
import boardLayout from 'src/assets/json/game/game.json';
import { SoundEffect, PresetSound } from './sound-effect';

export class TowerHelper {

  constructor(
    private commonActionService: CommonActionService,
  ) { }

  /** 右クリックされた card を起点に塔を作る */
  static makeTowerFromCard(base: Card): void {
    const common = CommonActionService.instance;
    if (!common) return;

    // どちら側の矢倉を使うか判定して 1 列目を取る
    const yagura = common.getYaguraColumn(0);
    if (!yagura || yagura.length === 0) return;

    const x = base.location.x;
    const rot = base.rotate;

    // 盤面上のすべてのカードを取得
    const allCards = ObjectStore.instance.getObjects<Card>(Card);

    // x が同じ & rotate が同じカードだけ抽出（すでにスタック中のカードは除外）
    const candidates = allCards.filter(card =>
      //      !card.isDeleted &&
      !(card.parent instanceof CardStack) &&
      card.location.x === x &&
      card.rotate === rot
    );

    if (candidates.length === 0) return;

    // ベースカードからの距離が近い順にソートし、最大 6 枚まで
    candidates.sort((a, b) =>
      Math.abs(a.location.y - base.location.y) - Math.abs(b.location.y - base.location.y)
    );
    const towerCards = candidates.slice(0, 6);

    // 新しいスタックを作成
    const stack = CardStack.create("塔"); // プロジェクトの実装に合わせてください
    stack.isLocked = true;

    // 矢倉 1 列目の 1 マス目にスタックを置く
    stack.location.x = base.location.x;
    stack.location.y = base.location.y;

    // カードをスタックに積む
    for (const card of towerCards) {
      card.location.x = stack.location.x;
      card.location.y = stack.location.y;
      stack.putOnTop(card); // 既存の appendCard / putOnTop などに合わせる
    }
    SoundEffect.play(PresetSound.cardPick);
  }
}
/** 塔（CardStack）を解放し、矢倉にばらす */

// パス名は実際のものに合わせてください

// player1 / player2 のキーを決めるヘルパ
function getPlayerKey(): 'player1' | 'player2' {
  const common = CommonActionService.instance;
  if (!common) return 'player1';

  const key = common.getCurrentPlayer(); // 仕様で教えてもらったメソッド
  return key === 'player2' ? 'player2' : 'player1';
}

// そのマスにカードが乗っているか？（座標一致で判定）
function isCellOccupied(cell: { x: number; y: number }): boolean {
  const cards = ObjectStore.instance.getObjects(Card);
  return cards.some(card => card.location.x === cell.x && card.location.y === cell.y);
}

// tou[1][1] → tou[2][1] → … → tou[6][1] の順で、空いている列を探す
function findEmptyTouRow(layoutForPlayer: any): number | null {
  if (!layoutForPlayer.tou) return null;

  for (let row = 1; row <= 6; row++) {
    const rowData = layoutForPlayer.tou[row];
    if (!rowData) continue;

    const baseCell = rowData[1]; // [row][1]
    if (!baseCell) continue;

    if (!isCellOccupied(baseCell)) {
      return row; // この列の [row][1]〜[row][6] を使う
    }
  }
  return null; // 全部埋まっている
}

export function releaseTower(stack: CardStack): void {
  if (!stack) return;

  const common = CommonActionService.instance;
  if (!common) return;

  const playerKey = getPlayerKey();                     // 'player1' / 'player2'
  const layoutForPlayer = (boardLayout as any)[playerKey];
  if (!layoutForPlayer) return;

  const rowIndex = findEmptyTouRow(layoutForPlayer);
  if (!rowIndex) {
    console.warn('配置可能な塔列がありません (tou[1〜6][1] が全て埋まっている)');
    return;
  }

  const touRow = layoutForPlayer.tou[rowIndex];
  if (!touRow) return;

  // 最大6枚取り出す
  const cards: Card[] = [];
  for (let i = 0; i < 6; i++) {
    const card = stack.drawCard() as Card | null;
    if (!card) break;
    cards.push(card);
  }

  if (cards.length === 0) {
    stack.destroy();
    return;
  }

  // ★ boardLayout 側の player1 / player2 の rotate を使う
  const playerRotate = (layoutForPlayer as any)?.rotate ?? 0;

  cards.forEach((card, i) => {
    const col = i + 1;                    // 必要なら右詰めに変えてOK
    const cell = touRow[col];
    if (!cell) {
      console.warn(`tou[${rowIndex}][${col}] が未定義です`, touRow);
      return;
    }

    card.location.x = cell.x;
    card.location.y = cell.y;
    card.state = CardState.FRONT;
    card.rotate = playerRotate;           // ★ ここで反映
  });

  SoundEffect.play(PresetSound.cardShuffle);
  stack.destroy();
}
