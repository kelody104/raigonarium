// src/app/service/raizan-setup.service.ts

import { Injectable } from '@angular/core';
import { Card, CardState } from 'src/app/class/card';
import { CardStack } from 'src/app/class/card-stack';
import { ObjectStore } from 'src/app/class/core/synchronize-object/object-store';
import { ImageStorage } from 'src/app/class/core/file-storage/image-storage';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';

import { buildRaizanDeck, RaigonCardDef, RAIzanPos } from './raizan-factory';

@Injectable({
  providedIn: 'root',
})
export class RaizanSetupService {

  /** 雷山を作って raizan1 / raizan2 に配置＆固定する */
  setupRaizan(includeOugi: boolean): { raizanStack: CardStack; raizanTop: Card | null } {

    // ① デッキ生成
    const deckDefs: RaigonCardDef[] = buildRaizanDeck(includeOugi);

    // ② CardStack(雷山) を作る
    const raizanStack = CardStack.create('雷山');

    // 裏面画像は全カード共通
    const backUrl = './assets/images/raigo/koma/ura.jpg';
    if (!ImageStorage.instance.get(backUrl)) {
      ImageStorage.instance.add(backUrl);
    }

    for (const def of deckDefs) {
      // 例：「一」 → ./assets/images/raigo/koma/一.jpg
      const frontUrl = `./assets/images/raigo/koma/${def.name}.jpg`;

      // 画像を ImageStorage に登録（なければ追加）
      if (!ImageStorage.instance.get(frontUrl)) {
        ImageStorage.instance.add(frontUrl);
      }

      // ★ front/back に URL をそのまま渡す
      const card = Card.create(def.name, frontUrl, backUrl, 1.8);

      // 追加情報（必要なら）
      (card as any).raigonKind = def.origin;
      (card as any).weight = def.weight;

      // 裏向きにして山の一番上へ
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

    // ⑤ 1枚引いて raizan2 に裏向きで配置 & ロック
    const topCard = raizanStack.drawCard();

    if (topCard) {
      topCard.state = CardState.BACK;
      topCard.location.x = RAIzanPos.raizan2.x;
      topCard.location.y = RAIzanPos.raizan2.y;
      topCard.isLocked = true;
      ObjectStore.instance.add(topCard);
    }
    SoundEffect.play(PresetSound.cardPut);
    return { raizanStack, raizanTop: topCard ?? null };
  }
}
