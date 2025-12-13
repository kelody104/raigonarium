import { Card } from '@udonarium/card';
import { CardStack } from '@udonarium/card-stack';

export type YakuType = '桜花' | '蓮花' | '偶数蓮花' | '奇数蓮花' | '雷神役' | '特殊役' | '組み合わせ' | '役無し' | '不穏';

export interface YakuResult {
  yakuName: string;
  yakuType: YakuType;
  basePoint: number;
  bonusPoint: number;
}

interface BonusBreakdown {
  heightBonus: number;
  dyeBonus: number;
  total: number;
}

/* --------------------------------
 * Stack/Card 取り出し（プロジェクト差吸収）
 * ※ TS2304 を潰すため、先頭に集約
 * -------------------------------- */
function getCardsFromStack(stack: CardStack): Card[] {
  const s: any = stack as any;

  if (Array.isArray(s.cards)) return s.cards as Card[];
  if (Array.isArray(s.cardList)) return s.cardList as Card[];
  if (typeof s.getCards === 'function') return s.getCards() as Card[];
  if (Array.isArray(s.children)) return (s.children as any[]).filter(x => x && typeof x === 'object') as Card[];

  return [];
}

function sortBottomToTop(cards: Card[]): Card[] {
  const withZ = cards.map(c => ({ c, z: getCardZ(c) }));
  const hasZ = withZ.every(x => Number.isFinite(x.z));
  if (!hasZ) return cards;

  return withZ.sort((a, b) => a.z - b.z).map(x => x.c);
}

function getCardZ(card: Card): number {
  const c: any = card as any;
  if (Number.isFinite(c.posZ)) return c.posZ;
  if (c.location && Number.isFinite(c.location.z)) return c.location.z;
  return NaN;
}

function getCardName(card: Card): string {
  const c: any = card as any;

  const name =
    c.name ??
    c.cardData?.name ??
    c.frontName ??
    c.cardData?.front?.name ??
    c.cardData?.detail?.name ??
    '';

  return String(name).trim();
}

function parseKanjiNumber(s: string): number | null {
  const map: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const t = String(s).trim();
  if (t in map) return map[t];
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

function getCardWeight(card: Card): number {
  const c: any = card as any;

  const raw =
    c.weight ??
    c.cardData?.detail?.weight ??
    c.cardData?.detail?.['重さ'] ??
    c.detail?.weight ??
    c.detail?.['重さ'];

  const n = Number(raw);
  if (Number.isFinite(n)) return n;

  const name = getCardName(card);
  const parsed = parseKanjiNumber(name);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getCardKind(card: Card): 'kotodama' | 'otonashi' | '不明' {
  const c: any = card as any;

  const raw =
    c.kind ??
    c.cardData?.detail?.kind ??
    c.cardData?.detail?.['種別'] ??
    c.detail?.kind ??
    c.detail?.['種別'];

  if (raw === 'kotodama' || raw === 'otonashi') return raw;

  // 推定：数字系ならotonashi、それ以外はkotodama
  const name = getCardName(card);
  if (parseKanjiNumber(name) != null) return 'otonashi';
  if (name.length > 0) return 'kotodama';

  return '不明';
}

/* --------------------------------
 * 役名装飾（基本役/組み合わせ役）
 *  - 三重/四重/五重/六重 を先頭に付与
 *  - 染め加点が発生する場合は「染め」をその後ろに付与
 *    例: 三重染め桜花
 * -------------------------------- */
function multiplicityPrefix(height: number): string {
  switch (height) {
    case 3: return '三重';
    case 4: return '四重';
    case 5: return '五重';
    case 6: return '六重';
    default: return '';
  }
}

function decorateBasicOrComboName(baseName: string, height: number, isDyed: boolean): string {
  const mult = multiplicityPrefix(height);
  const dye = isDyed ? '染め' : '';
  return `${mult}${dye}${baseName}`;
}

/* --------------------------------
 * 追加点（内訳）
 *  - 高さ加点: 4段目以降 1個につき +1
 *  - 染め加点: kotodamaのみ or otonashiのみ なら +1
 *    ※組み合わせ役は 6段のときのみ染め加点を許可
 * -------------------------------- */
function calcBonusBreakdown(cardsBottomToTop: Card[], combo: boolean = false): BonusBreakdown {
  const heightBonus = Math.max(0, cardsBottomToTop.length - 3);

  const kinds = cardsBottomToTop.map(getCardKind).filter(k => k !== '不明') as Array<'kotodama' | 'otonashi'>;
  let dyeBonus = 0;

  if (kinds.length === cardsBottomToTop.length) {
    const allSameKind = kinds.every(k => k === kinds[0]);
    if (allSameKind) {
      if (!combo || cardsBottomToTop.length === 6) dyeBonus = 1;
    }
  }

  return { heightBonus, dyeBonus, total: heightBonus + dyeBonus };
}

/* --------------------------------
 * 小物
 * -------------------------------- */
function allSame(arr: number[]): boolean {
  return arr.every(v => v === arr[0]);
}

function isStep(arr: number[], step: number): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + step) return false;
  }
  return true;
}

function hasHeavierOnLighter(weightsBottomToTop: number[]): boolean {
  for (let i = 1; i < weightsBottomToTop.length; i++) {
    // 下(=i-1)より上(i)が小さい => 上の方が重い
    if (weightsBottomToTop[i] < weightsBottomToTop[i - 1]) return true;
  }
  return false;
}

function matchSeq(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (String(actual[i]).trim() !== String(expected[i]).trim()) return false;
  }
  return true;
}

function matchAlt(arr: string[], a: string, b: string): boolean {
  if (arr.length !== 6) return false;
  return matchSeq(arr, [a, b, a, b, a, b]) || matchSeq(arr, [b, a, b, a, b, a]);
}

function countEq(arr: string[], v: string): number {
  return arr.filter(x => x === v).length;
}

function isThreePairs(arr: string[]): boolean {
  const m = new Map<string, number>();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  if (m.size !== 3) return false;
  return [...m.values()].every(c => c === 2);
}

/* --------------------------------
 * 判定：雷神役
 * -------------------------------- */
function judgeRaijin(namesBottomToTop: string[]): Omit<YakuResult, 'bonusPoint'> | null {
  if (namesBottomToTop.length !== 6) return null;

  const seq = namesBottomToTop;
  const rev = [...seq].reverse();

  const SHIGURE = ['斬', '陣', '轟', '霧', '瞬', '浄'];
  const KASUMI = ['轟', '轟', '轟', '霧', '瞬', '浄']; // 必要なら「車轍」に変更

  if (matchSeq(seq, SHIGURE) || matchSeq(rev, SHIGURE)) {
    return { yakuName: '時雨蓮花', yakuType: '雷神役', basePoint: 10 };
  }
  if (matchSeq(seq, KASUMI) || matchSeq(rev, KASUMI)) {
    return { yakuName: '霞・双頭蓮', yakuType: '雷神役', basePoint: 11 };
  }
  if (matchAlt(namesBottomToTop, '轟', '五')) {
    return { yakuName: '桜花乱舞', yakuType: '雷神役', basePoint: 11 };
  }

  if (matchAlt(namesBottomToTop, '霧', '六')) {
    return { yakuName: '霧幻輪廻', yakuType: '雷神役', basePoint: 12 };
  }

  if (namesBottomToTop.every(n => n === '斬')) {
    return { yakuName: '毘沙門槍', yakuType: '雷神役', basePoint: 12 };
  }

  if (countEq(namesBottomToTop, '六') === 2 && countEq(namesBottomToTop, '霧') === 2 && countEq(namesBottomToTop, '瞬') === 2) {
    return { yakuName: '六花白雪', yakuType: '雷神役', basePoint: 12 };
  }
  return null;
}

/* --------------------------------
 * 判定：基本役（固定の高得点）
 * -------------------------------- */
function judgeBasicFixed(namesBottomToTop: string[]): Omit<YakuResult, 'bonusPoint'> | null {
  if (namesBottomToTop.length !== 6) return null;



  return null;
}

/* --------------------------------
 * 判定：基本役（4種）
 * -------------------------------- */
function judgeBasicSimple(weightsBottomToTop: number[]): Omit<YakuResult, 'bonusPoint'> | null {
  if (weightsBottomToTop.length < 3) return null;

  if (allSame(weightsBottomToTop)) {
    return { yakuName: '桜花', yakuType: '桜花', basePoint: 2 };
  }

  if (isStep(weightsBottomToTop, 1)) {
    return { yakuName: '蓮花', yakuType: '蓮花', basePoint: 1 };
  }

  if (isStep(weightsBottomToTop, 2)) {
    const allEven = weightsBottomToTop.every(w => w % 2 === 0);
    const allOdd = weightsBottomToTop.every(w => w % 2 === 1);

    if (allEven) return { yakuName: '偶数蓮花', yakuType: '偶数蓮花', basePoint: 1 };
    if (allOdd) return { yakuName: '奇数蓮花', yakuType: '奇数蓮花', basePoint: 1 };
  }

  return null;
}

/* --------------------------------
 * 判定：特殊役（6段・追加点なし）
 * -------------------------------- */
function judgeSpecial(names: string[], weights: number[]): Omit<YakuResult, 'bonusPoint'> | null {
  if (weights.length !== 6) return null;

  if (isThreePairs(names)) {
    return { yakuName: '椿', yakuType: '特殊役', basePoint: 6 };
  }

  if (isThreePairs(weights.map(String))) {
    return { yakuName: '山茶花', yakuType: '特殊役', basePoint: 4 };
  }

  return null;
}

/* --------------------------------
 * 判定：組み合わせ役（6段・上3/下3）
 * -------------------------------- */
function comboSideType(w3: number[]): '桜' | '蓮' | null {
  if (w3.length !== 3) return null;
  if (allSame(w3)) return '桜';

  if (isStep(w3, 1)) return '蓮';
  if (isStep(w3, 2) && (w3.every(w => w % 2 === 0) || w3.every(w => w % 2 === 1))) return '蓮';

  return null;
}

function judgeCombo(weightsBottomToTop: number[]): Omit<YakuResult, 'bonusPoint'> | null {
  if (weightsBottomToTop.length !== 6) return null;

  const top3 = weightsBottomToTop.slice(0, 3);
  const bottom3 = weightsBottomToTop.slice(3, 6);

  const b = comboSideType(bottom3);
  const t = comboSideType(top3);

  if (!b || !t) return null;

  if (t === '桜' && b === '蓮') return { yakuName: '桜蓮花', yakuType: '組み合わせ', basePoint: 3 };
  if (t === '蓮' && b === '桜') return { yakuName: '蓮桜花', yakuType: '組み合わせ', basePoint: 3 };
  if (t === '桜' && b === '桜') return { yakuName: '桜々花', yakuType: '組み合わせ', basePoint: 4 };
  if (t === '蓮' && b === '蓮') return { yakuName: '蓮々花', yakuType: '組み合わせ', basePoint: 2 };

  return null;
}

/* --------------------------------
 * メイン：塔（CardStack）から役を判定
 * -------------------------------- */
export function judgeTowerYaku(stack: CardStack): YakuResult {
  const cards = getCardsFromStack(stack);
  const ordered = sortBottomToTop(cards); // 下→上
  const names = ordered.map(getCardName);
  const weights = ordered.map(getCardWeight);

  // 役無し（空/重量が取れない等）
  if (ordered.length === 0) return { yakuName: 'None', yakuType: '役無し', basePoint: 0, bonusPoint: 0 };
  if (weights.some(w => !Number.isFinite(w))) return { yakuName: 'None', yakuType: '役無し', basePoint: 0, bonusPoint: 0 };

  // 不穏（下に積んである駒よりも重い駒を積んでいる）
  // ※このプロジェクトの weight は「小さいほど重い」前提（例：一=1, 六=6）
  if (hasHeavierOnLighter(weights)) return { yakuName: 'None', yakuType: '不穏', basePoint: -1, bonusPoint: 0 };

  // 1) 雷神役（6段固定）
  const raijin = judgeRaijin(names);
  if (raijin) return { ...raijin, bonusPoint: 0 };

  // 2) 基本役（固定高得点）
  const basicFixed = judgeBasicFixed(names);
  if (basicFixed) {
    const bonus = calcBonusBreakdown(ordered);
    const yakuName = decorateBasicOrComboName(basicFixed.yakuName, ordered.length, bonus.dyeBonus > 0);
    return { ...basicFixed, yakuName, bonusPoint: bonus.total };
  }

  // 3) 基本役（4種）
  const basicSimple = judgeBasicSimple(weights);
  if (basicSimple) {
    const bonus = calcBonusBreakdown(ordered);
    const yakuName = decorateBasicOrComboName(basicSimple.yakuName, ordered.length, bonus.dyeBonus > 0);
    return { ...basicSimple, yakuName, bonusPoint: bonus.total };
  }

  // 4) 特殊役（追加点なし）
  const special = judgeSpecial(names, weights);
  if (special) return { ...special, bonusPoint: 0 };

  // 5) 組み合わせ役（6段固定）
  const combo = judgeCombo(weights);
  if (combo) {
    const bonus = calcBonusBreakdown(ordered, true);
    const yakuName = decorateBasicOrComboName(combo.yakuName, ordered.length, bonus.dyeBonus > 0);
    return { ...combo, yakuName, bonusPoint: bonus.total };
  }

  // 役無し
  return { yakuName: 'None', yakuType: '役無し', basePoint: 0, bonusPoint: 0 };
}
