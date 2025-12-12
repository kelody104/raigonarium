import kotodamaData from 'src/assets/json/koma/kotodama.json';
import otonashiData from 'src/assets/json/koma/otonashi.json';
import ougiData from 'src/assets/json/koma/ougi.json';
import gameLayout from 'src/assets/json/game/game.json';

export type RaigonOrigin = 'kotodama' | 'otonashi' | 'ougi';

/** JSON そのものの型（必要な項目だけ定義） */
interface SourceCard {
  id: number;
  data: string;
  name: string;
  yomi?: string;
  kind?: string;
  weight: number;
  countInGame?: number;
  effect?: string;
  text?: string;
  enabled?: boolean;
  [key: string]: any;
}

/** 雷山に積む 1 枚分の情報 */
export interface RaigonCardDef {
  id: number;
  data: string;
  name: string;
  yomi?: string;
  weight: number;
  effect?: string;
  text?: string;
  origin: RaigonOrigin; // どの山出身か（言霊 / 音無 / 奥義）
}

/** game.json の座標用 */
export interface RaizanPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 雷山まわりの座標（game.json から取得） */
export const RAIzanPos: {
  raizan1: RaizanPosition;
  raizan2: RaizanPosition;
  raizan3: RaizanPosition;
} = {
  raizan1: (gameLayout as any).common.raizan1 as RaizanPosition,
  raizan2: (gameLayout as any).common.raizan2 as RaizanPosition,
  raizan3: (gameLayout as any).common.raizan3 as RaizanPosition,
};

/**
 * 言霊 + 音無 (+ 奥義 1 種類) から雷山用デッキを展開する
 * @param includeOugi true のとき奥義を 1 種類だけ混ぜる
 */
export function buildRaizanDeck(includeOugi: boolean): RaigonCardDef[] {
  const deck: RaigonCardDef[] = [];

  const kotodamaList = kotodamaData as SourceCard[];
  const otonashiList = otonashiData as SourceCard[];
  const ougiList = ougiData as SourceCard[];

  const pushCards = (source: SourceCard[], origin: RaigonOrigin) => {
    for (const card of source) {
      if (card.enabled === false) continue; // enabled が false なら採用しない

      const count = (card.countInGame ?? 1) | 0;
      for (let i = 0; i < count; i++) {
        deck.push({
          id: card.id,
          data: card.data,
          name: card.name,
          yomi: card.yomi,
          weight: card.weight,
          effect: card.effect,
          text: card.text,
          origin,
        });
      }
    }
  };

  // 言霊 + 音無 を全部入れる
  pushCards(kotodamaList, 'kotodama');
  pushCards(otonashiList, 'otonashi');

  // 奥義を 1 種類だけ混ぜる
  if (includeOugi) {
    const enabledOugi = ougiList.filter(c => c.enabled !== false);
    if (enabledOugi.length > 0) {
      const index = Math.floor(Math.random() * enabledOugi.length);
      const chosen = enabledOugi[index];

      const count = (chosen.countInGame ?? 1) | 0;
      for (let i = 0; i < count; i++) {
        deck.push({
          id: chosen.id,
          data: chosen.data,
          name: chosen.name,
          yomi: chosen.yomi,
          weight: chosen.weight,
          effect: chosen.effect,
          text: chosen.text,
          origin: 'ougi',
        });
      }
    }
  }

  return deck;
}

/** Fisher–Yates でシャッフル */
export function shuffleDeck<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
