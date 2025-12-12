import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import { Card, CardState } from '@udonarium/card';
import { HostBinding } from '@angular/core';
import { CardStack } from '@udonarium/card-stack';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { ObjectInteractGesture } from 'component/game-table/object-interact-gesture';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { ImageService } from 'service/image.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';
import { TabletopService } from 'service/tabletop.service';
import { ChatMessageService } from 'service/chat-message.service';
import { SpectatorService } from 'service/spectator.service';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { TowerHelper } from 'src/app/class/tower-helper';
import { CommonActionService } from 'service/common-action.service';
import { GorgeService } from 'service/gorge.service';

@Component({
  selector: 'card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent implements OnDestroy, OnChanges, AfterViewInit {
  @Input() card: Card = null;
  @Input() is3D: boolean = false;
  @HostBinding('style.display')

  get name(): string { return this.card.name; }
  get state(): CardState { return this.card.state; }
  set state(state: CardState) { this.card.state = state; }
  get rotate(): number { return this.card.rotate; }
  set rotate(rotate: number) { this.card.rotate = rotate; }
  get owner(): string { return this.card.owner; }
  set owner(owner: string) { this.card.owner = owner; }
  get zindex(): number { return this.card.zindex; }
  get size(): number { return MathUtil.clampMin(this.card.size); }

  get isHand(): boolean { return this.card.isHand; }
  // 観戦モードのときは常に表面扱い
  get isFront(): boolean {
    if (this.spectatorService.enabled) return true;
    return this.card.isFront;
  }

  // 観戦モードのときは常に「見えている」扱い
  get isVisible(): boolean {
    if (this.spectatorService.enabled) return true;
    return this.card.isVisible;
  }
  get hasOwner(): boolean { return this.card.hasOwner; }
  get ownerIsOnline(): boolean { return this.card.ownerIsOnline; }
  get ownerName(): string { return this.card.ownerName; }

  get imageFile(): ImageFile { return this.imageService.getSkeletonOr(this.card.imageFile); }
  get frontImage(): ImageFile { return this.imageService.getSkeletonOr(this.card.frontImage); }
  get backImage(): ImageFile { return this.imageService.getSkeletonOr(this.card.backImage); }

  get selectionState(): SelectionState { return this.selectionService.state(this.card); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  private iconHiddenTimer: NodeJS.Timeout = null;
  get isIconHidden(): boolean { return this.iconHiddenTimer != null };
  get isLocked(): boolean { return this.card.isLocked; }
  set isLocked(v: boolean) { this.card.isLocked = v; }

  gridSize: number = 50;

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};

  private interactGesture: ObjectInteractGesture = null;

  constructor(
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private elementRef: ElementRef<HTMLElement>,
    private changeDetector: ChangeDetectorRef,
    private tabletopService: TabletopService,
    private selectionService: TabletopSelectionService,
    private imageService: ImageService,
    private pointerDeviceService: PointerDeviceService,
    private chatMessageService: ChatMessageService,
    private spectatorService: SpectatorService,   // ★追加
    private commonActionService: CommonActionService, // ★追加
    private gorgeService: GorgeService,
  ) { }

  get displayStyle(): string {
    // ★ gorgeService 側に「このカードが峡谷に格納されているか」を
    // 調べる isStored(card) を生やしておく前提です
    return this.gorgeService.isStored(this.card) ? 'none' : '';
  }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/aliasName/${PeerCursor.aliasName}`, event => {
        let object = ObjectStore.instance.get<PeerCursor>(event.data.identifier);
        if (this.card && object && object.userId === this.card.owner) {
          this.changeDetector.markForCheck();
        }
      })
      .on(`UPDATE_GAME_OBJECT/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_SELECTION/identifier/${this.card?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('DISCONNECT_PEER', event => {
        let cursor = PeerCursor.findByPeerId(event.data.peerId);
        if (!cursor || this.card.owner === cursor.userId) this.changeDetector.markForCheck();
      })
      // ★観戦モード変更時にも再描画
      .on('RAIGO_SPECTATOR_CHANGED', event => {
        this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.card,
      transformCssOffset: 'translateZ(0.15px)',
      colideLayers: ['terrain']
    };
    this.rotableOption = {
      tabletopObject: this.card
    };

  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.interactGesture = new ObjectInteractGesture(this.elementRef.nativeElement);
    });

    this.interactGesture.onstart = this.onInputStart.bind(this);
    this.interactGesture.oninteract = this.onDoubleClick.bind(this);
  }

  ngOnDestroy() {
    this.interactGesture.destroy();
    EventSystem.unregister(this);
  }

  @HostListener('carddrop', ['$event'])
  onCardDrop(e) {
    if (this.card === e.detail || (e.detail instanceof Card === false && e.detail instanceof CardStack === false)) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    if (e.detail instanceof CardStack) {
      let cardStack: CardStack = e.detail;
      let distance: number = this.card.calcSqrDistance(cardStack);
      if (distance < 25 ** 2) {
        cardStack.location.x = this.card.location.x;
        cardStack.location.y = this.card.location.y;
        cardStack.posZ = this.card.posZ;
        cardStack.putOnBottom(this.card);
      }
    }
  }

  onDoubleClick() {
    // オーナーがオンラインで、かつ手札でないカードは今まで通り触れない
    if (this.ownerIsOnline && !this.isHand) return;

    this.ngZone.run(() => {
      const myId = Network.peer.userId;

      const isBack = this.state === CardState.BACK;
      const isFront = this.state === CardState.FRONT;
      const isMine = this.owner === myId;
      const hasOwner = !!this.owner;

      // 自分だけ見る状態の判定：
      // 「裏向き ＆ owner が自分」
      const isPrivate = isBack && isMine;

      if (isBack && !hasOwner) {
        // ① 裏（共有） → 自分だけ見る
        this.card.faceDown();
        this.rotate = this.getMyViewRotate(); // ★ 自分視点の角度にする
        this.owner = myId;

      } else if (isPrivate) {
        // ② 自分だけ見る → 表（共有）
        this.card.faceUp();
        this.owner = '';

      } else {
        // ③ 表 or それ以外 → 裏（共有）
        this.card.faceDown();
        this.owner = '';
      }

      SoundEffect.play(PresetSound.cardDraw);
    });
  }


  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: MouseEvent | TouchEvent) {
    if (this.isLocked) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
      return;
    }

    this.ngZone.run(() => {
      this.card.toTopmost();
      this.startIconHiddenTimer();
    });
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let position = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(position, menuActions, this.isVisible ? this.name : 'カード');
  }

  // ドラッグ開始時
  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);

    // ★ ドラッグ開始（マスク ON）
    console.log(this.card.location.x + "," + this.card.location.y);
    this.gorgeService.beginDrag();
  }

  // ドラッグ終了時
  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
    this.ngZone.run(() => {
      // まず通常のドロップ処理で位置を確定
      this.dispatchCardDropEvent();

      // ★ ドロップ前に峡谷に入っているかどうかを覚えておく
      const storedBefore = this.gorgeService.isStored(this.card);

      // ★ 峡谷エリア内なら墓場プールに送って「消す」
      this.gorgeService.drop(this.card);

      //// ★ ドロップ後に峡谷に入ったかどうか判定し、入ったときだけログ
      //const storedAfter = this.gorgeService.isStored(this.card);
      //if (!storedBefore && storedAfter) {
      //  this.logGorge(this.card);
      //}

      // ★ ドラッグ終了（マスク OFF）
      this.gorgeService.endDrag();
    });
  }

  private createStack() {
    let cardStack = CardStack.create('山札');
    cardStack.location.x = this.card.location.x;
    cardStack.location.y = this.card.location.y;
    cardStack.posZ = this.card.posZ;
    cardStack.location.name = this.card.location.name;
    cardStack.rotate = this.rotate;
    cardStack.zindex = this.card.zindex;

    let cards: Card[] = this.tabletopService.cards.filter(card => {
      let distance: number = this.card.calcSqrDistance(card);
      return distance < 100 ** 2;
    });

    cards.sort((a, b) => {
      if (a.zindex < b.zindex) return 1;
      if (a.zindex > b.zindex) return -1;
      return 0;
    });

    for (let card of cards) {
      cardStack.putOnBottom(card);
    }
  }

  private dispatchCardDropEvent() {
    let element: HTMLElement = this.elementRef.nativeElement;
    let parent = element.parentElement;
    let children = parent.children;
    let event = new CustomEvent('carddrop', { detail: this.card, bubbles: true });
    for (let i = 0; i < children.length; i++) {
      children[i].dispatchEvent(event);
    }
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (this.selectionService.objects.length < 1) return [];

    let actions: ContextMenuAction[] = [];

    let objectPosition = {
      x: this.card.location.x + (this.card.size * this.gridSize) / 2,
      y: this.card.location.y + (this.card.size * this.gridSize) / 2,
      z: this.card.posZ
    };
    actions.push({ name: 'ここに集める', action: () => this.selectionService.congregate(objectPosition) });

    if (this.isSelected) {
      let selectedCards = () => this.selectionService.objects.filter(object => object.aliasName === this.card.aliasName) as Card[];
      actions.push(
        {
          name: '選択したカード', action: null, subActions: [
            {
              name: 'すべて表にする', action: () => {
                selectedCards().forEach(card => card.faceUp());
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
            {
              name: 'すべて裏にする', action: () => {
                selectedCards().forEach(card => card.faceDown());
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
            {
              name: 'すべて自分だけ見る', action: () => {
                selectedCards().forEach(card => {
                  card.faceDown();
                  card.owner = Network.peer.userId;
                });
                SoundEffect.play(PresetSound.cardDraw);
              }
            },
          ]
        }
      );
    }
    actions.push(this.isLocked
      ? {
        name: '固定解除', action: () => {
          this.isLocked = false;
          SoundEffect.play(PresetSound.unlock);
        }
      }
      : {
        name: '固定する', action: () => {
          this.isLocked = true;
          SoundEffect.play(PresetSound.lock);
        }
      });
    actions.push(ContextMenuSeparator);

    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    let actions: ContextMenuAction[] = [];

    actions.push({
      name: '塔をまとめる',
      action: () => TowerHelper.makeTowerFromCard(this.card),
    });

    actions.push(!this.isVisible || this.isHand
      ? {
        name: '表にする', action: () => {
          this.card.faceUp();
          SoundEffect.play(PresetSound.cardDraw);
        }
      }
      : {
        name: '裏にする', action: () => {
          this.card.faceDown();
          SoundEffect.play(PresetSound.cardDraw);
        }
      });
    actions.push(this.isHand
      ? {
        name: '裏にする', action: () => {
          this.card.faceDown();
          SoundEffect.play(PresetSound.cardDraw);
        }
      }
      : {
        name: '自分だけ見る', action: () => {
          SoundEffect.play(PresetSound.cardDraw);
          this.card.faceDown();
          this.rotate = this.getMyViewRotate(); // ★ 自分視点の角度にする
          this.owner = Network.peer.userId;
        }
      });
    actions.push(ContextMenuSeparator);
    actions.push({
      name: '重なったカードで山札を作る', action: () => {
        this.createStack();
        SoundEffect.play(PresetSound.cardPut);
      }
    });
    actions.push(ContextMenuSeparator);
    actions.push({ name: 'カードを編集', action: () => { this.showDetail(this.card); } });
    actions.push({ name: '発する', action: () => { this.play(this.card); } });
    actions.push({
      name: 'コピーを作る', action: () => {
        let cloneObject = this.card.clone();
        cloneObject.location.x += this.gridSize;
        cloneObject.location.y += this.gridSize;
        cloneObject.toTopmost();
        SoundEffect.play(PresetSound.cardPut);
      }
    });
    actions.push({
      name: '削除する', action: () => {
        this.card.destroy();
        SoundEffect.play(PresetSound.sweep);
      }
    });
    return actions;
  }

  private startIconHiddenTimer() {
    clearTimeout(this.iconHiddenTimer);
    this.iconHiddenTimer = setTimeout(() => {
      this.iconHiddenTimer = null;
      this.changeDetector.markForCheck();
    }, 300);
    this.changeDetector.markForCheck();
  }

  private showDetail(gameObject: Card) {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = 'カード設定';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 300, top: coordinate.y - 300, width: 600, height: 600 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  private play(card: Card) {
    const tabList = ChatTabList.instance;
    if (!tabList || !tabList.chatTabs.length) return;

    const gamelog =
      tabList.chatTabs.find(t => t.name === '対戦ログ') ??
      tabList.chatTabs[0];

    if (!gamelog) return;

    // ② 表示したいテキスト
    const text = `${card.name} を発した`;

    // ③ 送信元（自分のカーソル）を指定
    const fromId = PeerCursor.myCursor.identifier;

    // ④ 実際に送信
    const msg = this.chatMessageService.sendMessage(
      gamelog,
      text,
      'system',   // tag（ゲームタイプ）。'system' にするとシステムメッセージ扱いしやすい
      fromId,
      null        // sendTo：特定の宛先がなければ null
    );

    // ★ここを追加：このログを発生させたプレイヤーのアイコンで固定する
    const my = PeerCursor.myCursor;
    if (my && my.imageIdentifier) {
      msg.imageIdentifier = my.imageIdentifier;
      msg.update(); // ChatMessage が持っている update() があれば呼んでおく
    }

    // ★秘匿フラグを付ける
    // 「持ち主のみ見える駒」かどうかの判定は、あなたのルールに合わせて調整してください。
    // 例：owner が空でないなら秘匿扱い
    const isSecretForOthers = !!card.owner;
    const senderUserId = Network.peer.userId; // 送信者（自分）の userId

    // 形式: RAIGO_PIECE:<cardId>:<secretFlag>:<senderUserId>
    msg.dicebot = `RAIGO_PIECE:${card.identifier}:${isSecretForOthers ? '1' : '0'}:${senderUserId}`;

    msg.update?.();
  }

  ///** 峡谷に駒を捨てたときのログ */
  //private logGorge(card: Card) {
  //  const tabList = ChatTabList.instance;
  //  if (!tabList || !tabList.chatTabs.length) return;

  //  // 「対戦ログ」タブがあればそこへ、なければ先頭タブ
  //  const gamelog =
  //    tabList.chatTabs.find(t => t.name === '対戦ログ') ??
  //    tabList.chatTabs[0];

  //  if (!gamelog) return;

  //  // 表示テキスト
  //  const text = `${card.name} を峡谷に置いた`;

  //  // 送信元（自分のカーソル）
  //  const fromId = PeerCursor.myCursor.identifier;

  //  // 実際に送信（「発した」と同じ仕組み）
  //  const msg = this.chatMessageService.sendMessage(
  //    gamelog,
  //    text,
  //    'system',
  //    fromId,
  //    null
  //  );

  //  // 送信者アイコンを固定
  //  const my = PeerCursor.myCursor;
  //  if (my && my.imageIdentifier) {
  //    msg.imageIdentifier = my.imageIdentifier;
  //    msg.update();
  //  }

  //  // owner が付いているカードなら「秘匿扱い」にする例
  //  const isSecretForOthers = !!card.owner;
  //  const senderUserId = Network.peer.userId;

  //  // 「発した」と区別できるよう、別のタグ名にしておく
  //  // 例: RAIGO_GORGE
  //  msg.dicebot = `RAIGO_GORGE:${card.identifier}:${isSecretForOthers ? '1' : '0'}:${senderUserId}`;
  //  msg.update?.();
  //}



  private getMyViewRotate(): number {
    // 現在のプレイヤー: 'player1' | 'player2'
    const player = this.commonActionService.getCurrentPlayer();
    // player1 = 0度, player2 = 180度 というルールにする
    return player === 'player1' ? 0 : 180;
  }
}
