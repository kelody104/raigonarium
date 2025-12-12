// gorge.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Card } from 'src/app/class/card';
import { CardStack } from 'src/app/class/card-stack';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { CommonActionService } from 'src/app/service/common-action.service';
import { PresetSound, SoundEffect } from '../class/sound-effect';

// ★ 追加
import { ChatMessageService } from 'service/chat-message.service';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { PeerCursor } from '@udonarium/peer-cursor';
import { Network } from '@udonarium/core/system';

export type PlayerKey = 'player1' | 'player2';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

@Injectable({
  providedIn: 'root'
})
export class GorgeService {

  /** 各プレイヤーの峡谷エリア矩形 */
  private rects: Record<PlayerKey, Rect | null> = {
    player1: null,
    player2: null,
  };

  /** 各プレイヤーの通常駒プール name -> cardId[] */
  private pools: Record<PlayerKey, Map<string, string[]>> = {
    player1: new Map<string, string[]>(),
    player2: new Map<string, string[]>(),
  };

  /** 各プレイヤーの奥義プール（カードID配列） */
  private ougiPools: Record<PlayerKey, string[]> = {
    player1: [],
    player2: [],
  };

  /** 各プレイヤーの現在の奥義名（最後に捨てられた奥義） */
  private ougiNames: Record<PlayerKey, string | null> = {
    player1: null,
    player2: null,
  };

  /** 「いまドラッグ中かどうか」のフラグ（マスク表示用） */
  private hoverSubject = new BehaviorSubject<boolean>(false);
  readonly hover$ = this.hoverSubject.asObservable();

  constructor(
    private commonActionService: CommonActionService,
    private chatMessageService: ChatMessageService,
  ) { }

  /** player1／player2 の峡谷矩形を登録 */
  init(rect1: Rect, rect2: Rect): void {
    this.rects.player1 = rect1;
    this.rects.player2 = rect2;
  }

  /** テンプレート側から矩形取得 */
  getRect(player: PlayerKey): Rect | null {
    return this.rects[player];
  }

  /** ドラッグ開始／終了（マスク表示用） */
  beginDrag(): void {
    this.hoverSubject.next(true);
  }

  endDrag(): void {
    this.hoverSubject.next(false);
  }

  /** いまの座標がどちら側の峡谷か判定 */
  private detectPlayerByPoint(x: number, y: number): PlayerKey | null {
    for (const p of ['player1', 'player2'] as PlayerKey[]) {
      const r = this.rects[p];
      if (!r) continue;
      if (x >= r.x && x <= r.x + r.width &&
        y >= r.y && y <= r.y + r.height) {
        return p;
      }
    }
    return null;
  }

  /** カードを峡谷に捨てる（onMoved から呼ばれる） */
  drop(card: Card): void {
    const pos = card.location;
    const player = this.detectPlayerByPoint(pos.x, pos.y);
    if (!player) return;

    const name = card.name;
    if (!name) return;

    const isOugi = name === '奥義' || name === 'ougi';

    if (isOugi) {
      this.ougiNames[player] = name;
      this.ougiPools[player].push(card.identifier);
    } else {
      const pool = this.pools[player];
      const list = pool.get(name) ?? [];
      list.push(card.identifier);
      pool.set(name, list);
    }

    // ★ 捨てたログ
    this.logGorgeAction(card, player, 'drop');

    card.setLocation('graveyard');
  }


  /** 峡谷関連のログ出力（action: 'drop' = 捨てる, 'take' = 取り出す） */
  private logGorgeAction(card: Card, player: PlayerKey, action: 'drop' | 'take'): void {
    const tabList = ChatTabList.instance;
    if (!tabList || !tabList.chatTabs.length) return;

    // 「対戦ログ」タブがあればそこへ、なければ先頭タブへ
    const gamelog =
      tabList.chatTabs.find(t => t.name === '対戦ログ') ??
      tabList.chatTabs[0];
    if (!gamelog) return;

    const verb = action === 'drop' ? 'を峡谷に置いた。' : 'を峡谷から取り出した。';
    const text = `${card.name} ${verb}`;

    const fromId = PeerCursor.myCursor?.identifier ?? '';

    const msg = this.chatMessageService.sendMessage(
      gamelog,
      text,
      'system',
      fromId,
      null
    );

    // プレイヤーのアイコンを固定
    const my = PeerCursor.myCursor;
    if (my && my.imageIdentifier) {
      msg.imageIdentifier = my.imageIdentifier;
      msg.update();
    }

    // 秘匿フラグなどを「発した」と同じ形式で付ける
    const isSecretForOthers = !!card.owner;
    const senderUserId = Network.peer.userId;

    // 形式はお好みで。ここでは RAIGO_GORGE にしています
    msg.dicebot = `RAIGO_GORGE:${card.identifier}:${isSecretForOthers ? '1' : '0'}:${senderUserId}:${action}`;
    msg.update?.();
  }

  // ---------- カウント系 ----------

  /** 特定プレイヤーの name の枚数を返す */
  getCount(name: string, player: PlayerKey): number {
    const pool = this.pools[player];
    const list = pool.get(name);
    return list ? list.length : 0;
  }

  /** 特定プレイヤーの奥義名 */
  getOugiName(player: PlayerKey): string | null {
    return this.ougiNames[player];
  }

  /** 特定プレイヤーの奥義枚数 */
  getOugiCount(player: PlayerKey): number {
    return this.ougiPools[player].length;
  }

  // ---------- 取り出し系（駒アイコンのダブルクリック） ----------

  /** 通常駒を 1 枚取り出す */
  takeOne(name: string, player: PlayerKey): void {
    const pool = this.pools[player];
    const list = pool.get(name);
    if (!list || list.length === 0) return;

    const cardId = list.pop()!;
    if (list.length === 0) pool.delete(name);

    const card = ObjectStore.instance.get<Card>(cardId);
    if (!card) return;
    SoundEffect.play(PresetSound.cardDraw);

    this.placeFromGorge(card, player);
  }

  /** 奥義を 1 枚取り出す */
  takeOugi(player: PlayerKey): void {
    const pool = this.ougiPools[player];
    if (pool.length === 0) return;

    const cardId = pool.pop()!;
    const card = ObjectStore.instance.get<Card>(cardId);
    if (!card) return;

    this.placeFromGorge(card, player);
    SoundEffect.play(PresetSound.cardDraw);

    if (pool.length === 0) {
      this.ougiNames[player] = null;
    }
  }

  /** 山札引き出し位置（player1／2 の draw[0] にカードを出す） */
  private placeFromGorge(card: Card, player: PlayerKey): void {
    const slot = this.commonActionService.getDrawPositionByIndex(0, player);
    if (!slot) return;

    card.location.x = slot.x;
    card.location.y = slot.y;
    card.setLocation("table");

    // 向き：player2 は 180 度、それ以外は 0 度
    card.rotate = (player === 'player2') ? 180 : 0;

    // ★ 取り出したログ
    this.logGorgeAction(card, player, 'take');
  }

  // 例：峡谷プール内にあれば true を返す
  // 例：峡谷プール内にあれば true を返す
  isStored(card: Card | null): boolean {
    if (!card) return false;

    const id = card.identifier;

    // player1 / player2 両方のプールを調べる
    for (const player of ['player1', 'player2'] as PlayerKey[]) {
      // 奥義プール
      const ougiPool = this.ougiPools[player];
      if (ougiPool.includes(id)) return true;

      // 通常駒プール
      const pool = this.pools[player];
      for (const ids of pool.values()) {
        if (ids.includes(id)) return true;
      }
    }
    return false;
  }
}
