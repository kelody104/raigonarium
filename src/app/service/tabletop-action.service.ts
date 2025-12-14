import { Injectable } from '@angular/core';
import { Card, CardState } from '@udonarium/card';
import { CardStack } from '@udonarium/card-stack';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { DiceSymbol, DiceType } from '@udonarium/dice-symbol';
import { GameCharacter } from '@udonarium/game-character';
import { GameTable } from '@udonarium/game-table';
import { GameTableMask } from '@udonarium/game-table-mask';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { TableSelecter } from '@udonarium/table-selecter';
import { Terrain } from '@udonarium/terrain';
import { TextNote } from '@udonarium/text-note';
import { LobbyComponent } from 'component/lobby/lobby.component';
import { ContextMenuAction } from './context-menu.service';
import { PointerCoordinate } from './pointer-device.service';
import { RaizanSetupService } from './raizan-setup.service';
import { ViewportCaptureService } from './viewport-capture.service';
import { CommonActionService } from 'service/common-action.service';
import { ModalService } from 'service/modal.service';
import { Piece } from 'models/piece';

@Injectable({ providedIn: 'root' })
export class TabletopActionService {
  private raigoOngomaIdentifier: string = null; // 隠駒Terrain（チェスクロック格納）

  constructor(
    private viewportCapture: ViewportCaptureService,
    private raizanSetupService: RaizanSetupService,
    private commonActionService: CommonActionService,
    private modalService: ModalService,
  ) { }

  // ========= 基本 =========
  private ensureImage(url: string): ImageFile {
    let img = ImageStorage.instance.get(url);
    if (!img) img = ImageStorage.instance.add(url);
    return img;
  }

  private getViewTable(): GameTable {
    return TableSelecter.instance.viewTable;
  }

  private getViewTableSafe(): GameTable {
    const vt = this.getViewTable();
    if (vt) return vt;
    const id = TableSelecter.instance.viewTableIdentifier;
    const obj = id ? ObjectStore.instance.get(id) : null;
    return (obj && obj.aliasName === 'gameTable') ? (obj as GameTable) : null;
  }

  // ========= 生成 =========
  createGameCharacter(position: PointerCoordinate): GameCharacter {
    const character = GameCharacter.create('新しいキャラクター', 1, '');
    character.location.x = position.x - 25;
    character.location.y = position.y - 25;
    character.posZ = position.z;
    return character;
  }

  createGameTableMask(position: PointerCoordinate): GameTableMask {
    const viewTable = this.getViewTableSafe();
    if (!viewTable) return;

    const tableMask = GameTableMask.create('マップマスク', 5, 5, 100);
    tableMask.location.x = position.x - 25;
    tableMask.location.y = position.y - 25;
    tableMask.posZ = position.z;

    viewTable.appendChild(tableMask);
    return tableMask;
  }

  createTerrain(position: PointerCoordinate): Terrain {
    const viewTable = this.getViewTableSafe();
    if (!viewTable) return;

    const image = this.ensureImage('./assets/images/tex.jpg');
    const terrain = Terrain.create('地形', 2, 2, 2, image.identifier, image.identifier);
    terrain.location.x = position.x - 50;
    terrain.location.y = position.y - 50;
    terrain.posZ = position.z;

    viewTable.appendChild(terrain);
    return terrain;
  }

  createTextNote(position: PointerCoordinate): TextNote {
    const textNote = TextNote.create('共有メモ', 'テキストを入力してください', 5, 4, 3);
    textNote.location.x = position.x;
    textNote.location.y = position.y;
    textNote.posZ = position.z;
    return textNote;
  }

  // 標準ダイス（旧来の createDiceSymbol(position,name,type,prefix) 互換）
  createDiceSymbol(position: PointerCoordinate, name: string, diceType: DiceType, imagePathPrefix: string): DiceSymbol;
  // 雷轟D6（既存の createDiceSymbol(position) 互換）
  createDiceSymbol(position: PointerCoordinate): DiceSymbol;
  createDiceSymbol(position: PointerCoordinate, name?: string, diceType?: DiceType, imagePathPrefix?: string): DiceSymbol {
    const viewTable = this.getViewTableSafe();
    if (!viewTable) return;

    // 雷轟D6（引数なし）
    if (!name) {
      const diceSymbol = DiceSymbol.create('ダイス', 1, 1);
      diceSymbol.location.x = position.x;
      diceSymbol.location.y = position.y;
      diceSymbol.posZ = position.z;

      ['face1', 'face2', 'face3', 'face4', 'face5', 'face6'].forEach((face, i) => {
        const url = `./assets/images/raigo/DiceSymbol/dice_${i + 1}.png`;
        const img = this.ensureImage(url);
        diceSymbol.imageDataElement.getFirstElementByName(face).value = img.identifier;
      });

      viewTable.appendChild(diceSymbol);
      return diceSymbol;
    }

    // 標準ダイス
    const ds = DiceSymbol.create(name, diceType, 1);
    ds.faces.forEach(face => {
      const url = `./assets/images/dice/${imagePathPrefix}/${imagePathPrefix}[${face}].png`;
      const img = this.ensureImage(url);
      ds.imageDataElement.getFirstElementByName(face).value = img.identifier;
    });
    ds.location.x = position.x - 25;
    ds.location.y = position.y - 25;
    ds.posZ = position.z;
    viewTable.appendChild(ds);
    return ds;
  }

  createTrump(position: PointerCoordinate): CardStack {
    const cardStack = CardStack.create('トランプ山札');
    cardStack.location.x = position.x - 25;
    cardStack.location.y = position.y - 25;
    cardStack.posZ = position.z;

    const back = './assets/images/trump/z02.gif';
    this.ensureImage(back);

    const suits = ['c', 'd', 'h', 's'];
    const trumps: string[] = [];
    for (const suit of suits) for (let i = 1; i <= 13; i++) trumps.push(suit + (('00' + i).slice(-2)));
    trumps.push('x01', 'x02');

    for (const trump of trumps) {
      const url = `./assets/images/trump/${trump}.gif`;
      this.ensureImage(url);
      const card = Card.create('カード', url, back);
      cardStack.putOnBottom(card);
    }

    const viewTable = this.getViewTableSafe();
    if (viewTable) viewTable.appendChild(cardStack);
    return cardStack;
  }

  // ========= 初期化 =========
  makeDefaultTable() {
    // 既に viewTable が存在するならそれを初期化する（新規に GameTable を作って viewTableIdentifier を差し替えると表示が崩れる）
    const existing = this.getViewTableSafe();
    const gameTable = existing ?? new GameTable('gameTable');

    const bgFront = ImageFile.createEmpty('table_bg_front').toContext();
    const bgBack = ImageFile.createEmpty('table_bg_back').toContext();
    bgFront.url = './assets/images/raigo/field.png';
    bgBack.url = './assets/images/raigo/BG.png';

    const front = ImageStorage.instance.add(bgFront);
    const back = ImageStorage.instance.add(bgBack);

    gameTable.name = '雷山の里';
    gameTable.imageIdentifier = front.identifier;
    gameTable.backgroundImageIdentifier = back.identifier;
    gameTable.width = 49;
    gameTable.height = 28;
    gameTable.initialize();

    // viewTable が無かった場合だけ、ObjectStore に登録して表示対象にする
    if (!existing) {
      ObjectStore.instance.add(gameTable);
      TableSelecter.instance.viewTableIdentifier = gameTable.identifier;
    }
    EventSystem.register(this);
  }

  makeDefaultTabletopObjects() {
    // 隠駒(ongoma)を固定配置（ここにチェスクロックも格納）
    //this.createRaigoOngoma();

  }

  // ========= 隠駒(ongoma) =========
  createRaigoOngoma(): Terrain {
    const viewTable = this.getViewTableSafe();
    if (!viewTable) return;

    const floor = this.ensureImage('./assets/images/raigo/on.png');
    const wall = this.ensureImage('./assets/images/raigo/on_wall.png');

    const terrain = Terrain.create('隠駒', 8.5, 8.5, 0, wall.identifier, floor.identifier);
    terrain.location.x = 1013;
    terrain.location.y = 488;
    terrain.posZ = 0;
    terrain.isLocked = true;

    viewTable.appendChild(terrain);

    // チェスクロック初期化（Terrainにぶら下げる）
    this.raigoOngomaIdentifier = terrain.identifier;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    return terrain;
  }

  // ========= 右クリックメニュー =========
  makeDefaultContextMenuActions(position: PointerCoordinate): ContextMenuAction[] {
    return [
      this.getCreateCharacterMenu(position),
      this.getCreateTableMaskMenu(position),
      this.getCreateTerrainMenu(position),
      this.getCreateTextNoteMenu(position),
      this.getCreateTrumpMenu(position),
      this.getCreateDiceSymbolMenu(position),
    ];
  }

  private getCreateCharacterMenu(position: PointerCoordinate): ContextMenuAction {
    return {
      name: 'キャラクターを作成', action: () => {
        const character = this.createGameCharacter(position);
        EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: character.identifier, className: character.aliasName });
        SoundEffect.play(PresetSound.piecePut);
      }
    };
  }

  private getCreateTableMaskMenu(position: PointerCoordinate): ContextMenuAction {
    return {
      name: 'マップマスクを作成', action: () => {
        this.createGameTableMask(position);
        SoundEffect.play(PresetSound.cardPut);
      }
    };
  }

  private getCreateTerrainMenu(position: PointerCoordinate): ContextMenuAction {
    return {
      name: '地形を作成', action: () => {
        this.createTerrain(position);
        SoundEffect.play(PresetSound.blockPut);
      }
    };
  }

  private getCreateTextNoteMenu(_position: PointerCoordinate): ContextMenuAction {
    return {
      name: '共有メモを作成',
      action: () => {
        // 既存仕様：雷山生成へ
        this.raizanSetupService.setupRaizan(true);
      }
    };
  }

  private getCreateTrumpMenu(position: PointerCoordinate): ContextMenuAction {
    return {
      name: 'トランプの山札を作成', action: () => {
        this.createTrump(position);
        SoundEffect.play(PresetSound.cardPut);
      }
    };
  }

  private getCreateDiceSymbolMenu(position: PointerCoordinate): ContextMenuAction {
    const sub: ContextMenuAction[] = [];

    // 雷轟D6
    sub.push({
      name: '雷轟D6', action: () => {
        this.createDiceSymbol(position);
        SoundEffect.play(PresetSound.dicePut);
      }
    });

    // 標準ダイス
    const dices: { menuName: string; diceName: string; type: DiceType; imagePathPrefix: string }[] = [
      { menuName: 'D4', diceName: 'D4', type: DiceType.D4, imagePathPrefix: '4_dice' },
      { menuName: 'D6', diceName: 'D6', type: DiceType.D6, imagePathPrefix: '6_dice' },
      { menuName: 'D8', diceName: 'D8', type: DiceType.D8, imagePathPrefix: '8_dice' },
      { menuName: 'D10', diceName: 'D10', type: DiceType.D10, imagePathPrefix: '10_dice' },
      { menuName: 'D10 (00-90)', diceName: 'D10', type: DiceType.D10_10TIMES, imagePathPrefix: '100_dice' },
      { menuName: 'D12', diceName: 'D12', type: DiceType.D12, imagePathPrefix: '12_dice' },
      { menuName: 'D20', diceName: 'D20', type: DiceType.D20, imagePathPrefix: '20_dice' },
    ];
    dices.forEach(d => sub.push({
      name: d.menuName,
      action: () => {
        this.createDiceSymbol(position, d.diceName, d.type, d.imagePathPrefix);
        SoundEffect.play(PresetSound.dicePut);
      }
    }));

    return { name: 'ダイスを作成', action: null, subActions: sub };
  }

  // ========= スクショ =========
  onClickCaptureViewport() {
    this.viewportCapture.captureViewport('udonarium-screen.png', 800);
  }

  // ========= 駒生成 =========
  // ========= 駒生成 =========
  // Piece を渡された場合は、json由来の各種情報を Card にも付与する
  getCreateRaigokoma(pieceOrName: Piece | string) {
    const piece: Piece | null = (typeof pieceOrName === 'string') ? null : pieceOrName;
    const name: string = (typeof pieceOrName === 'string') ? pieceOrName : (pieceOrName as any).name;

    const frontUrl = `./assets/images/raigo/koma/${name}.jpg`;
    const backUrl = `./assets/images/raigo/koma/ura.jpg`;

    if (!ImageStorage.instance.get(frontUrl)) {
      ImageStorage.instance.add(frontUrl);
    }

    if (!ImageStorage.instance.get(backUrl)) {
      ImageStorage.instance.add(backUrl);
    }

    const card = Card.create(name, frontUrl, backUrl, 1.8);

    if (piece) this.applyPieceInfoToCard(card, piece);

    card.state = CardState.FRONT;
    card.location.x = 1550;
    card.location.y = 1275;
    console.log(card);
    SoundEffect.play(PresetSound.cardDraw);
    return card;
  }

  // ========= 名札 =========
  createNameplate(name: string, rank: number): Card {
    const url = this.getNameplateUrl_(rank);

    // 画像を確実に登録
    this.ensureImage(url);

    // 指定どおり（表裏同じ画像、サイズ8）
    const card = Card.create('名札', url, url, 8);
    card.state = CardState.FRONT;

    // card.name は getter-only のことがあるので commonDataElement の name を更新する
    const c: any = card as any;
    const common: any = c?.commonDataElement;
    const nameEl =
      common?.getFirstElementByName?.('name')
      ?? (common?.children ?? []).find((x: any) => x?.name === 'name');

    if (nameEl) nameEl.value = name;

    // 置き場所（とりあえず駒と同じ。必要なら引数に position を増やす）
    const player = this.commonActionService.getCurrentPlayer();

    card.location.x = (player === 'player1') ? 50 : 2000;
    card.location.y = (player === 'player1') ? 1240 : 45;
    card.posZ = 0;

    SoundEffect.play(PresetSound.cardDraw);
    return card;
  }

  private getNameplateUrl_(rank: number): string {
    switch (rank) {
      case 0: return './assets/images/raigo/nameplate/temp.png';
      case 1: return './assets/images/raigo/nameplate/temp[1].png';
      case 2: return './assets/images/raigo/nameplate/temp[1].png';
      case 3: return './assets/images/raigo/nameplate/temp[1].png';
      case 4: return './assets/images/raigo/nameplate/temp[1].png';
      case 5: return './assets/images/raigo/nameplate/temp[2].png';
      case 6: return './assets/images/raigo/nameplate/temp[2].png';
      case 7: return './assets/images/raigo/nameplate/temp[2].png';
      case 8: return './assets/images/raigo/nameplate/temp[2].png';
      case 9: return './assets/images/raigo/nameplate/temp[2].png';
      case 10: return './assets/images/raigo/nameplate/temp[3].png';
      case 11: return './assets/images/raigo/nameplate/temp[4].png';
      case 12: return './assets/images/raigo/nameplate/temp[5].png';
      case 13: return './assets/images/raigo/nameplate/temp[6].png';
      case 14: return './assets/images/raigo/nameplate/temp[7].png';
      case 15: return './assets/images/raigo/nameplate/temp[8].png';
      default: return './assets/images/raigo/nameplate/temp.png';    }
  }



  // jsonにある id,data,name,yomi,kind,weight,countInGame,effect,text,enabled,
  // specialstr1,specialstr2,specialnum1,specialnum2,specialboo1,specialboo2 を Card に付与する
  private applyPieceInfoToCard(card: Card, piece: Piece): void {
    const c: any = card as any;

    // Card の「表示名」は getter-only なので、commonDataElement の name を更新する
    const setDataElementValue = (el: any, v: any) => {
      const s = (v === undefined || v === null) ? '' : String(v);
      if (!el) return;
      if ('value' in el) el.value = s;
      else if ('currentValue' in el) el.currentValue = s;
      else el.value = s;
    };

    const common: any = c?.commonDataElement;
    if (common && (piece as any).name !== undefined) {
      const nameEl =
        common.getFirstElementByName?.('name')
        ?? (common.children ?? []).find((x: any) => x?.name === 'name');
      setDataElementValue(nameEl, (piece as any).name);
    }

    const keys = [
      'id', 'data', 'name', 'yomi', 'kind', 'weight', 'countInGame', 'effect', 'text', 'enabled',
      'specialstr1', 'specialstr2', 'specialnum1', 'specialnum2', 'specialboo1', 'specialboo2'
    ] as const;

    for (const k of keys) {
      const v = (piece as any)[k];
      if (v === undefined) continue;

      // getter-only（setter無し）プロパティには代入しない（name 等）
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(card), k);
      const getterOnly = !!desc && typeof desc.get === 'function' && !desc.set;
      if (getterOnly) continue;

      try {
        c[k] = v;
      } catch {
        // 代入できないものは無視（同期オブジェクトのgetter-only等の事故回避）
      }
    }

    // 既存コード互換
    if ((piece as any).id !== undefined) c.raigonId = (piece as any).id;
    if ((piece as any).kind !== undefined) c.raigonKind = (piece as any).kind;
    if ((piece as any).weight !== undefined) c.weight = (piece as any).weight;

    // commonDataElement.detail にも入れて参照しやすくする（ここは従来通り）
    const detail = this.ensureDetailElement(c);
    const cid = String(c.identifier ?? '');

    this.setDetailValue(detail, 'id', (piece as any).id, cid);
    this.setDetailValue(detail, 'data', (piece as any).data, cid);
    this.setDetailValue(detail, 'name', (piece as any).name, cid);
    this.setDetailValue(detail, 'yomi', (piece as any).yomi, cid);
    this.setDetailValue(detail, 'kind', (piece as any).kind, cid);
    this.setDetailValue(detail, 'weight', (piece as any).weight, cid);
    this.setDetailValue(detail, 'countInGame', (piece as any).countInGame, cid);
    this.setDetailValue(detail, 'effect', (piece as any).effect, cid);
    this.setDetailValue(detail, 'text', (piece as any).text, cid);
    this.setDetailValue(detail, 'enabled', (piece as any).enabled, cid);
    this.setDetailValue(detail, 'specialstr1', (piece as any).specialstr1, cid);
    this.setDetailValue(detail, 'specialstr2', (piece as any).specialstr2, cid);
    this.setDetailValue(detail, 'specialnum1', (piece as any).specialnum1, cid);
    this.setDetailValue(detail, 'specialnum2', (piece as any).specialnum2, cid);
    this.setDetailValue(detail, 'specialboo1', (piece as any).specialboo1, cid);
    this.setDetailValue(detail, 'specialboo2', (piece as any).specialboo2, cid);
  }

  private ensureDetailElement(cardLike: any): any {
    const root: any = cardLike?.commonDataElement;
    if (!root) return null;

    const children: any[] = root.children ?? [];
    let detail = children.find((x: any) => x?.name === 'detail');

    if (!detail) {
      detail = DataElement.create('detail', '', {}, `detail_${cardLike.identifier}`);
      root.appendChild(detail);
    }

    return detail;
  }

  private setDetailValue(detail: any, key: string, value: any, cardId: string): void {
    if (!detail) return;

    const children: any[] = detail.children ?? [];
    let child = children.find((x: any) => x?.name === key);
    const v = (value === undefined || value === null) ? '' : String(value);

    if (!child) {
      child = DataElement.create(key, v, {}, `${key}_${cardId}`);
      detail.appendChild(child);
      return;
    }

    if ('value' in child) (child as any).value = v;
    else if ('currentValue' in child) (child as any).currentValue = v;
    else (child as any).value = v;
  }


  // ========= チェスクロック（隠駒Terrainに格納） =========
  getChessClockTerrain(): Terrain {
    if (this.raigoOngomaIdentifier) {
      const obj: any = ObjectStore.instance.get(this.raigoOngomaIdentifier);
      if (obj && obj.aliasName === 'terrain') return obj as Terrain;
    }
    // フォールバック：名前で探索
    const viewTable: any = this.getViewTableSafe() as any;
    const children: any[] = viewTable?.children ?? [];
    const found = children.find(c => c?.aliasName === 'terrain' && c?.name === '隠駒');
    if (found) this.raigoOngomaIdentifier = found.identifier;
    return found as Terrain;
  }

  getChessClockView(now: number = Date.now()): { p1Ms: number; p2Ms: number; running: boolean; active: 'P1' | 'P2' | ''; } {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return { p1Ms: 0, p2Ms: 0, running: false, active: '' };

    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    const p1 = this.getClockNumber(terrain, 'clock_p1_ms', 25 * 60 * 1000);
    const p2 = this.getClockNumber(terrain, 'clock_p2_ms', 25 * 60 * 1000);
    const running = this.getClockBool(terrain, 'clock_running', false);
    const active = this.getClockString(terrain, 'clock_active', '') as any;
    const anchor = this.getClockNumber(terrain, 'clock_anchor_at', 0);

    if (!running || (active !== 'P1' && active !== 'P2') || anchor <= 0) {
      return { p1Ms: p1, p2Ms: p2, running, active: (active === 'P1' || active === 'P2') ? active : '' };
    }

    const dt = Math.max(0, now - anchor);
    if (active === 'P1') return { p1Ms: Math.max(0, p1 - dt), p2Ms: p2, running, active };
    return { p1Ms: p1, p2Ms: Math.max(0, p2 - dt), running, active };
  }

  chessClockReset(initMs: number = 25 * 60 * 1000): void {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return;
    this.ensureChessClockElements(terrain, initMs);

    this.setClockNumber(terrain, 'clock_p1_ms', initMs);
    this.setClockNumber(terrain, 'clock_p2_ms', initMs);
    this.setClockBool(terrain, 'clock_running', false);
    this.setClockString(terrain, 'clock_active', '');
    this.setClockNumber(terrain, 'clock_anchor_at', 0);

    SoundEffect.play(PresetSound.lock);
  }

  chessClockStart(active: 'P1' | 'P2' = 'P1'): void {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    if (this.getClockBool(terrain, 'clock_running', false)) return;

    const currentActive = this.getClockString(terrain, 'clock_active', '');
    if (currentActive !== 'P1' && currentActive !== 'P2') this.setClockString(terrain, 'clock_active', active);

    this.setClockBool(terrain, 'clock_running', true);
    this.setClockNumber(terrain, 'clock_anchor_at', Date.now());
    SoundEffect.play(PresetSound.on);
  }

  chessClockPause(): void {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    if (!this.getClockBool(terrain, 'clock_running', false)) return;

    this.applyClockElapsed(terrain, Date.now());
    this.setClockBool(terrain, 'clock_running', false);
    this.setClockNumber(terrain, 'clock_anchor_at', 0);
    SoundEffect.play(PresetSound.unlock);
  }

  chessClockSetActive(player: 'P1' | 'P2'): void {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);
    if (this.getClockBool(terrain, 'clock_running', false)) return;
    this.setClockString(terrain, 'clock_active', player);
  }

  chessClockSwitch(): void {
    const terrain = this.getChessClockTerrain();
    if (!terrain) return;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    if (!this.getClockBool(terrain, 'clock_running', false)) return;

    this.applyClockElapsed(terrain, Date.now());

    const active = this.getClockString(terrain, 'clock_active', '');
    const next = active === 'P1' ? 'P2' : 'P1';
    this.setClockString(terrain, 'clock_active', next);
    this.setClockNumber(terrain, 'clock_anchor_at', Date.now());

    SoundEffect.play(PresetSound.blockPut);
  }

  // 隠駒を触った時に手番切替（動作中のみ）
  chessClockSwitchFromOngoma(terrain: Terrain): void {
    if (!terrain || terrain.aliasName !== 'terrain' || terrain.name !== '隠駒') return;
    this.ensureChessClockElements(terrain, 25 * 60 * 1000);

    if (!this.getClockBool(terrain, 'clock_running', false)) return;

    this.applyClockElapsed(terrain, Date.now());

    const active = this.getClockString(terrain, 'clock_active', '');
    const next = active === 'P1' ? 'P2' : 'P1';
    this.setClockString(terrain, 'clock_active', next);
    this.setClockNumber(terrain, 'clock_anchor_at', Date.now());
  }

  private ensureChessClockElements(terrain: Terrain, initMs: number): void {
    const cd: any = (terrain as any).commonDataElement;
    if (!cd) return;

    const ensure = (name: string, value: any) => {
      const exists = cd.getFirstElementByName?.(name);
      if (exists) return;
      cd.appendChild(DataElement.create(name, value, {}, `${name}_${terrain.identifier}`));
    };

    ensure('clock_p1_ms', initMs);
    ensure('clock_p2_ms', initMs);
    ensure('clock_running', false);
    ensure('clock_active', '');
    ensure('clock_anchor_at', 0);
  }

  private applyClockElapsed(terrain: Terrain, now: number): void {
    const running = this.getClockBool(terrain, 'clock_running', false);
    const active = this.getClockString(terrain, 'clock_active', '');
    const anchor = this.getClockNumber(terrain, 'clock_anchor_at', 0);

    if (!running || (active !== 'P1' && active !== 'P2') || anchor <= 0) {
      this.setClockNumber(terrain, 'clock_anchor_at', now);
      return;
    }

    const dt = Math.max(0, now - anchor);
    if (dt <= 0) return;

    let p1 = this.getClockNumber(terrain, 'clock_p1_ms', 0);
    let p2 = this.getClockNumber(terrain, 'clock_p2_ms', 0);

    if (active === 'P1') p1 = Math.max(0, p1 - dt);
    else p2 = Math.max(0, p2 - dt);

    this.setClockNumber(terrain, 'clock_p1_ms', p1);
    this.setClockNumber(terrain, 'clock_p2_ms', p2);
    this.setClockNumber(terrain, 'clock_anchor_at', now);

    if (p1 === 0 || p2 === 0) {
      this.setClockBool(terrain, 'clock_running', false);
      this.setClockNumber(terrain, 'clock_anchor_at', 0);
    }
  }

  private getClockElement(terrain: Terrain, name: string): any {
    const cd: any = (terrain as any).commonDataElement;
    return cd?.getFirstElementByName?.(name) ?? null;
  }

  private getClockNumber(terrain: Terrain, name: string, fallback: number): number {
    const el = this.getClockElement(terrain, name);
    const v = el ? Number(el.value) : fallback;
    return Number.isFinite(v) ? v : fallback;
  }

  private setClockNumber(terrain: Terrain, name: string, value: number): void {
    const el = this.getClockElement(terrain, name);
    if (el) el.value = value;
  }

  private getClockBool(terrain: Terrain, name: string, fallback: boolean): boolean {
    const el = this.getClockElement(terrain, name);
    return el ? Boolean(el.value) : fallback;
  }

  private setClockBool(terrain: Terrain, name: string, value: boolean): void {
    const el = this.getClockElement(terrain, name);
    if (el) el.value = value;
  }

  private getClockString(terrain: Terrain, name: string, fallback: string): string {
    const el = this.getClockElement(terrain, name);
    return el ? String(el.value ?? '') : fallback;
  }

  private setClockString(terrain: Terrain, name: string, value: string): void {
    const el = this.getClockElement(terrain, name);
    if (el) el.value = value;
  }
}
