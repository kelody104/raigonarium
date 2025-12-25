import { Injectable } from '@angular/core';
import { Card, CardState } from '@udonarium/card';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { GameTable } from '@udonarium/game-table';
import { TableSelecter } from '@udonarium/table-selecter';

export interface RaigoTowerRecord {
  towerName: string;
  pieceNamesText: string;
}

export interface RaigoPlayerScoreRecord {
  iconIdentifier: string;
  name: string;
  userId: string;

  // UI表示用（常に scoreBase + 雷轟解放*2 - 禁忌 を維持）
  score: number;

  // 内部：手動得点（scoreの編集はこれに反映される）
  scoreBase: number;

  towers: RaigoTowerRecord[];
  pieceTotal: number;
  innerPieceTotal: number;

  raigoReleaseCount: number;
  tabooCount: number;

  // 互換用
  __lastRaigoReleaseCount?: number;
  __lastTabooCount?: number;
}

interface RaigoScoreBoardState {
  version: 1;
  players: [RaigoPlayerScoreRecord, RaigoPlayerScoreRecord];
}

type PlayerIndex = 0 | 1;

@Injectable({ providedIn: 'root' })
export class RaigoScoreBoardStateService {
  private readonly ELEMENT_NAME = 'raigo_score_board_state_v1';

  // 名札（固定IDで1枚にする）
  private readonly NAMEPLATE_CARD_IDS = ['raigo_nameplate_p1', 'raigo_nameplate_p2'] as const;
  private readonly NAMEPLATE_SIZE = 8;
  private readonly NAMEPLATE_POSITIONS = [{ x: 0, y: 0 }, { x: 0, y: 0 }] as const;

  private cacheJson = '';
  private state: RaigoScoreBoardState = this.createInitialState();

  get players(): [RaigoPlayerScoreRecord, RaigoPlayerScoreRecord] {
    return this.state.players;
  }

  /** 盤面（GameTable）に状態が無ければ初期状態を作る。あれば読み込む。 */
  ensureInitialized(): void {
    const table = this.getViewTableSafe();
    if (!table) return;

    const common = this.getCommonData(table);
    if (!common) return;

    const el = common.getFirstElementByName(this.ELEMENT_NAME);
    const json = String(el?.value ?? '').trim();

    if (!json) {
      this.normalizeAndRecalc();
      const initial = JSON.stringify(this.state);
      if (el) el.value = initial;
      else common.appendChild(DataElement.create(this.ELEMENT_NAME, initial, {}, `${this.ELEMENT_NAME}_${table.identifier}`));
      this.cacheJson = initial;
      return;
    }

    this.pull();
  }

  /** 他プレイヤーの更新を取り込む（必要時のみ） */
  pull(): void {
    const table = this.getViewTableSafe();
    if (!table) return;

    const common = this.getCommonData(table);
    if (!common) return;

    const el = common.getFirstElementByName(this.ELEMENT_NAME);
    const json = String(el?.value ?? '').trim();
    if (!json || json === this.cacheJson) return;

    try {
      const parsed = JSON.parse(json);
      this.state = this.normalizeState(parsed);
      this.normalizeAndRecalc();
      this.cacheJson = JSON.stringify(this.state);
    } catch {
      // noop
    }
  }

  /** ローカルの編集内容を盤面へ反映（差分がある時だけ） */
  flush(): void {
    const table = this.getViewTableSafe();
    if (!table) return;

    const common = this.getCommonData(table);
    if (!common) return;

    this.normalizeAndRecalc();
    const json = JSON.stringify(this.state);
    if (json === this.cacheJson) return;

    const el = common.getFirstElementByName(this.ELEMENT_NAME);
    if (el) el.value = json;
    else common.appendChild(DataElement.create(this.ELEMENT_NAME, json, {}, `${this.ELEMENT_NAME}_${table.identifier}`));

    this.cacheJson = json;
  }

  // ===== 得点ボードが閉じていても呼べるAPI =====

  /** P1/P2押下時：ゲーム進行系だけ初期化 */
  resetGameplay(playerIndex: PlayerIndex, flushAfter: boolean = true): void {
    this.pull();

    const p = this.state.players[playerIndex];
    p.scoreBase = 2;
    p.score = 2;
    p.towers = [];
    p.pieceTotal = 0;
    p.innerPieceTotal = 0;
    p.raigoReleaseCount = 0;
    p.tabooCount = 0;

    p.__lastRaigoReleaseCount = 0;
    p.__lastTabooCount = 0;

    if (flushAfter) this.flush();
  }

  setIdentity(playerIndex: PlayerIndex, iconIdentifier: string, name: string, userId: string, flushAfter: boolean = true): void {
    this.pull();

    const p = this.state.players[playerIndex];
    p.iconIdentifier = iconIdentifier ?? '';
    p.name = name ?? '';
    p.userId = userId ?? '';

    if (flushAfter) this.flush();
  }

  /** ベース得点を加算（塔解放など、ボード非表示でも呼べる） */
  addScoreBase(playerIndex: PlayerIndex, delta: number, flushAfter: boolean = true): void {
    this.pull();

    const p = this.state.players[playerIndex];
    p.scoreBase = this.toNumber(p.scoreBase) + this.toNumber(delta);

    if (flushAfter) this.flush();
  }

  /**
 * 塔解放：playerName と一致するプレイヤー(P1/P2)に
 * - towers へ追加
 * - scoreBase へ加点（最終scoreはflush時に自動再計算）
 */
  applyTowerReleaseByPlayerName(
    playerName: string,
    towerName: string,
    pieceNamesText: string,
    scoreDelta: number,
    flushAfter: boolean = true
  ): boolean {
    // ★ ボードを開いていなくても動くように
    this.ensureInitialized();
    this.pull();

    const name = (playerName ?? '').trim();
    if (!name) return false;

    let idx: PlayerIndex | null = null;
    if ((this.state.players[0].name ?? '').trim() === name) idx = 0;
    else if ((this.state.players[1].name ?? '').trim() === name) idx = 1;
    else return false;

    const p = this.state.players[idx];

    // 塔追加
    p.towers.push({
      towerName: String(towerName ?? ''),
      pieceNamesText: String(pieceNamesText ?? '')
    });

    // ★ここが本題：score ではなく scoreBase に加算する
    const delta = this.toNumber(scoreDelta);
    p.scoreBase = this.toNumber(p.scoreBase) + delta;

    // ★表示即反映のため score も合わせる（flushでも再計算されるが念のため）
    const adj = this.toNumber(p.raigoReleaseCount) * 2 - this.toNumber(p.tabooCount);
    p.score = this.toNumber(p.scoreBase) + adj;

    if (flushAfter) this.flush();
    return true;
  }


  /** 名札を(0,0)に生成/更新（固定IDなので1枚に収束） */
  upsertNameplate(playerIndex: PlayerIndex, playerName: string, family: string = '', rank: number = 0): void {
    const table = this.getViewTableSafe();
    if (!table) return;

    const url = this.getNameplateUrl(rank);
    const img = this.ensureImage(url);
    const imageId = img.identifier;

    const identifier = this.NAMEPLATE_CARD_IDS[playerIndex];
    let card = ObjectStore.instance.get<Card>(identifier);

    if (!card) {
      // Card.create には「画像identifier」を渡す（URL文字列ではなく）
      card = Card.create(`名札 P${playerIndex + 1}`, imageId, imageId, this.NAMEPLATE_SIZE, identifier);
      table.appendChild(card);
    } else {
      table.appendChild(card);
    }

    // front/back を確実に更新
    const front = card.imageDataElement?.getFirstElementByName?.('front');
    const back = card.imageDataElement?.getFirstElementByName?.('back');
    if (front) front.value = imageId;
    if (back) back.value = imageId;

    const setCommon = (name: string, value: any) => {
      const el = card.commonDataElement.getFirstElementByName(name);
      if (el) el.value = value;
      else card.commonDataElement.appendChild(DataElement.create(name, value, {}, `${name}_${card.identifier}`));
    };
    setCommon('playerName', playerName ?? '');
    setCommon('Family', family ?? '');
    setCommon('rank', this.toNumber(rank));

    card.state = CardState.FRONT;
    card.owner = '';
    card.rotate = 0;

    const pos = this.NAMEPLATE_POSITIONS[playerIndex];
    card.location.name = 'table';
    card.location.x = pos.x;
    card.location.y = pos.y;
    card.posZ = 0;

    card.toTopmost();
  }

  // ===== 内部 =====

  private createInitialState(): RaigoScoreBoardState {
    const p = () =>
      ({
        iconIdentifier: '',
        name: '',
        userId: '',
        score: 2,
        scoreBase: 2,
        towers: [],
        pieceTotal: 0,
        innerPieceTotal: 0,
        raigoReleaseCount: 0,
        tabooCount: 0,
        __lastRaigoReleaseCount: 0,
        __lastTabooCount: 0,
      }) as RaigoPlayerScoreRecord;

    return { version: 1, players: [p(), p()] };
  }

  private normalizeState(src: any): RaigoScoreBoardState {
    const base = this.createInitialState();
    const players = Array.isArray(src?.players) ? src.players : null;

    const normPlayer = (s: any, fallback: RaigoPlayerScoreRecord): RaigoPlayerScoreRecord => {
      const towers: RaigoTowerRecord[] = Array.isArray(s?.towers)
        ? s.towers.map((t: any) => ({
          towerName: String(t?.towerName ?? ''),
          pieceNamesText: String(t?.pieceNamesText ?? '')
        }))
        : [];

      const raigoReleaseCount = this.toNumber(s?.raigoReleaseCount ?? fallback.raigoReleaseCount);
      const tabooCount = this.toNumber(s?.tabooCount ?? fallback.tabooCount);
      const adj = raigoReleaseCount * 2 - tabooCount;

      const score = this.toNumber(s?.score ?? fallback.score);
      const hasScoreBase = s?.scoreBase !== undefined && s?.scoreBase !== null && Number.isFinite(Number(s?.scoreBase));
      const scoreBase = hasScoreBase ? this.toNumber(s?.scoreBase) : (score - adj);

      return {
        iconIdentifier: String(s?.iconIdentifier ?? fallback.iconIdentifier),
        name: String(s?.name ?? fallback.name),
        userId: String(s?.userId ?? fallback.userId),

        scoreBase,
        score: scoreBase + adj,

        towers,
        pieceTotal: this.toNumber(s?.pieceTotal ?? fallback.pieceTotal),
        innerPieceTotal: this.toNumber(s?.innerPieceTotal ?? fallback.innerPieceTotal),

        raigoReleaseCount,
        tabooCount,

        __lastRaigoReleaseCount: this.toNumber(s?.__lastRaigoReleaseCount ?? raigoReleaseCount),
        __lastTabooCount: this.toNumber(s?.__lastTabooCount ?? tabooCount),
      };
    };

    if (!players || players.length < 2) return base;
    return { version: 1, players: [normPlayer(players[0], base.players[0]), normPlayer(players[1], base.players[1])] };
  }

  /**
   * - score は常に scoreBase + (雷轟解放*2 - 禁忌)
   * - scoreBase は「手入力得点」を保持
   */
  private normalizeAndRecalc(): void {
    for (const p of this.state.players) {
      // 塔構成(pieceTotal)
      p.pieceTotal = p.towers.reduce((sum, t) => sum + this.countPieces(t.pieceNamesText), 0);

      const nowRelease = this.toNumber(p.raigoReleaseCount);
      const nowTaboo = this.toNumber(p.tabooCount);
      const adj = nowRelease * 2 - nowTaboo;

      p.scoreBase = this.toNumber(p.scoreBase);
      p.score = p.scoreBase + adj;

      p.__lastRaigoReleaseCount = nowRelease;
      p.__lastTabooCount = nowTaboo;
    }
  }

  private countPieces(pieceNamesText: string): number {
    const s = (pieceNamesText ?? '').replace(/\s/g, '');
    return s.length;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * 名札ファイル名：
   * - rank=0 => temp.jpg
   * - rank>=1 => temp[rank].jpg
   */
  private getNameplateUrl(rank: number): string {
    const r = Math.max(0, Math.floor(this.toNumber(rank)));
    if (r <= 0) return `./assets/images/raigo/nameplate/temp.jpg`;
    return `./assets/images/raigo/nameplate/temp[${r}].jpg`;
  }

  private ensureImage(url: string): ImageFile {
    let img = ImageStorage.instance.get(url);
    if (!img) img = ImageStorage.instance.add(url);
    return img;
  }

  private getCommonData(table: GameTable): DataElement | null {
    const t: any = table as any;
    return (t.commonDataElement ?? t.tableDataElement ?? t.tabletopObjectDataElement ?? t.dataElement) as DataElement ?? null;
  }

  private getViewTableSafe(): GameTable {
    const vt = TableSelecter.instance.viewTable;
    if (vt) return vt;

    const id = TableSelecter.instance.viewTableIdentifier;
    const obj = id ? ObjectStore.instance.get(id) : null;
    if (obj && (obj as any).aliasName === 'gameTable') return obj as GameTable;

    const byFixedId = ObjectStore.instance.get('gameTable' as any);
    if (byFixedId && (byFixedId as any).aliasName === 'gameTable') return byFixedId as GameTable;

    try {
      const storeAny: any = ObjectStore.instance as any;
      const maps: any[] = [storeAny.objects, storeAny.objectMap, storeAny._objects, storeAny._objectMap].filter(Boolean);

      for (const m of maps) {
        if (m instanceof Map) {
          for (const v of m.values()) if (v?.aliasName === 'gameTable') return v as GameTable;
        } else if (Array.isArray(m)) {
          for (const v of m) if (v?.aliasName === 'gameTable') return v as GameTable;
        }
      }
    } catch {
      // noop
    }

    return null;
  }
}
