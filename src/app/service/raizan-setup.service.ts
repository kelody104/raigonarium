// src/app/service/raizan-setup.service.ts

import { Injectable } from '@angular/core';
import { Card, CardState } from 'src/app/class/card';
import { CardStack } from 'src/app/class/card-stack';
import { ObjectStore } from 'src/app/class/core/synchronize-object/object-store';
import { ImageStorage } from 'src/app/class/core/file-storage/image-storage';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { Piece } from 'models/piece';

import {
  buildRaizanDeck,
  buildRaizanDeckFromSettings,
  RaigonCardDef,
  RAIzanPos,
} from './raizan-factory';

import gameLayout from 'src/assets/json/game/game.json';
import { PlayerKey } from 'service/gorge.service';
import { CommonActionService } from 'service/common-action.service';

type BattleMode = '雷轟戦モード' | '雷神戦モード';

@Injectable({
  providedIn: 'root',
})
export class RaizanSetupService {

  /**
   * ★モーダルの内容を反映して雷山を生成
   *   - otonashi / kotodama / ougi の Piece 配列の countInGame をそのまま使う
   *   - battleMode === '雷神戦モード' のときは、雷山には奥義を入れない（※月に置く想定）
   *   - useGora === true のときは、除外する1枚（raizan2）を表向きにする
   */
  setupRaizanFromSettings(params: {
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
    battleMode?: BattleMode;
    useGora?: boolean;
  }): { raizanStack: CardStack; raizanTop: Card | null } {
    const { otonashi, kotodama, ougi, battleMode, useGora } = params;

    // 雷神戦モードなら奥義は雷山に入れない（＝月に置く前提）
    const ougiForDeck = (battleMode === '雷神戦モード') ? [] : (ougi ?? []);

    // ★ここは3引数のまま（TS2554回避）
    const deckDefs = buildRaizanDeckFromSettings(
      otonashi ?? [],
      kotodama ?? [],
      ougiForDeck,
    );

    return this.buildRaizanFromDeckDefs(deckDefs, !!useGora);
  }

  /**
   * ★従来の雷山生成
   *   - JSON デフォルトの countInGame とランダム奥義 1 種
   */
  setupRaizan(includeOugi: boolean): {
    raizanStack: CardStack;
    raizanTop: Card | null;
  } {
    const deckDefs: RaigonCardDef[] = buildRaizanDeck(includeOugi);
    return this.buildRaizanFromDeckDefs(deckDefs, false);
  }

  /**
   * ★雷神戦モード用「月に置く」
   *   - countInGame === 1 の奥義駒を、現在プレイヤーの tsuki 座標に
   *     1つの CardStack として配置し、その山にカードを乗せる
   */
  placeOugiToTsuki(ougiPieces: Piece[]): void {
    if (!ougiPieces || ougiPieces.length === 0) return;

    // 念のためここでも countInGame === 1 だけに絞る
    const targetPieces = ougiPieces.filter(p => {
      const c = Number((p as any).countInGame ?? 0);
      return c === 1;
    });
    if (targetPieces.length === 0) return;

    const player = this.getCurrentPlayer();
    const tsukiPos = this.getTsukiPosition(player);

    if (!tsukiPos) {
      console.warn('tsuki 座標が game.json に見つかりません:', player);
      return;
    }

    const backUrl = './assets/images/raigo/koma/ura.jpg';
    if (!ImageStorage.instance.get(backUrl)) {
      ImageStorage.instance.add(backUrl);
    }

    // ★ 月用の山札（CardStack）を作成
    const tsukiStack = CardStack.create('月');
    tsukiStack.location.x = tsukiPos.x;
    tsukiStack.location.y = tsukiPos.y;
    tsukiStack.isLocked = true;

    // ★ player2 側のときだけ 180 度回転
    if (player === 'player2') {
      tsukiStack.rotate = 180;
    }

    ObjectStore.instance.add(tsukiStack);

    // ★ countInGame === 1 の奥義だけカードを作って積む
    for (const piece of targetPieces) {
      const name = (piece as any).name as string;
      if (!name) continue;

      const frontUrl = `./assets/images/raigo/koma/${name}.jpg`;

      if (!ImageStorage.instance.get(frontUrl)) {
        ImageStorage.instance.add(frontUrl);
      }

      const card = Card.create(name, frontUrl, backUrl, 1.8);
      (card as any).raigonId = (piece as any).id;

      card.state = CardState.FRONT;
      tsukiStack.putOnTop(card);
    }

    tsukiStack.unifyCardsSize(1.8);
    tsukiStack.uprightAll();
  }

  /** 現在のプレイヤーを取得（なければ player1 扱い） */
  private getCurrentPlayer(): PlayerKey {
    const common = CommonActionService.instance;
    if (!common) return 'player1';
    return common.getCurrentPlayer() as PlayerKey;
  }

  /** game.json から tsuki 座標を取得 */
  private getTsukiPosition(player: PlayerKey): { x: number; y: number } | null {
    const layout: any = gameLayout as any;
    const playerLayout = layout && layout[player];

    if (!playerLayout || !playerLayout.tsuki) return null;

    const tsuki = playerLayout.tsuki;
    return { x: tsuki.x, y: tsuki.y };
  }

  /**
   * 共通部分：deckDefs から実際の Card / CardStack を構築する
   * - useGora === true の場合、raizan2 に出す1枚を表にする
   */
  private buildRaizanFromDeckDefs(deckDefs: RaigonCardDef[], useGora: boolean): {
    raizanStack: CardStack;
    raizanTop: Card | null;
  } {
    // ① CardStack(雷山) を作る
    const raizanStack = CardStack.create('雷山');

    // 裏面画像は全カード共通
    const backUrl = './assets/images/raigo/koma/ura.jpg';
    if (!ImageStorage.instance.get(backUrl)) {
      ImageStorage.instance.add(backUrl);
    }

    // ② deckDefs からカードを作成して山に積む
    for (const def of deckDefs) {
      const frontUrl = `./assets/images/raigo/koma/${def.name}.jpg`;

      if (!ImageStorage.instance.get(frontUrl)) {
        ImageStorage.instance.add(frontUrl);
      }

      const card = Card.create(def.name, frontUrl, backUrl, 1.8);

      (card as any).raigonKind = def.origin;
      (card as any).weight = def.weight;
      (card as any).raigonId = def.id;

      card.state = CardState.BACK;
      raizanStack.putOnTop(card);
    }

    // ③ シャッフル
    raizanStack.shuffle();

    // ④ raizan1 に配置 & ロック & 正位置
    raizanStack.location.x = RAIzanPos.raizan1.x;
    raizanStack.location.y = RAIzanPos.raizan1.y;
    raizanStack.isLocked = true;
    ObjectStore.instance.add(raizanStack);
    raizanStack.uprightAll();

    // ⑤ 1枚引いて raizan2 に配置 & ロック
    const topCard = raizanStack.drawCard();

    if (topCard) {
      topCard.state = useGora ? CardState.FRONT : CardState.BACK; // ★ここが「豪雷を使用する」
      topCard.location.x = RAIzanPos.raizan2.x;
      topCard.location.y = RAIzanPos.raizan2.y;
      topCard.isLocked = true;
      ObjectStore.instance.add(topCard);
      topCard.rotate = 0;
    }

    SoundEffect.play(PresetSound.cardShuffle);

    return { raizanStack, raizanTop: topCard ?? null };
  }
}
