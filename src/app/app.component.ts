import { AfterViewInit, Component, NgZone, OnDestroy, OnInit, ViewChild, ViewContainerRef, HostListener } from '@angular/core';

import { ChatTabList } from '@udonarium/chat-tab-list';
import { AudioPlayer } from '@udonarium/core/file-storage/audio-player';
import { AudioSharingSystem } from '@udonarium/core/file-storage/audio-sharing-system';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ImageFile, ImageContext } from '@udonarium/core/file-storage/image-file';
import { ImageSharingSystem } from '@udonarium/core/file-storage/image-sharing-system';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ObjectFactory } from '@udonarium/core/synchronize-object/object-factory';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ObjectSynchronizer } from '@udonarium/core/synchronize-object/object-synchronizer';
import { EventSystem, Network } from '@udonarium/core/system';
import { DataSummarySetting } from '@udonarium/data-summary-setting';
import { DiceBot } from '@udonarium/dice-bot';
import { Jukebox } from '@udonarium/Jukebox';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { TableSelecter } from '@udonarium/table-selecter';
import { Terrain } from '@udonarium/terrain';

import { ChatWindowComponent } from 'component/chat-window/chat-window.component';
import { ContextMenuComponent } from 'component/context-menu/context-menu.component';
import { FileStorageComponent } from 'component/file-storage/file-storage.component';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { GameObjectInventoryComponent } from 'component/game-object-inventory/game-object-inventory.component';
import { GameTableSettingComponent } from 'component/game-table-setting/game-table-setting.component';
import { JukeboxComponent } from 'component/jukebox/jukebox.component';
import { LobbyComponent } from 'component/lobby/lobby.component';
import { ModalComponent } from 'component/modal/modal.component';
import { PeerMenuComponent } from 'component/peer-menu/peer-menu.component';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { UIPanelComponent } from 'component/ui-panel/ui-panel.component';
import { AppConfig, AppConfigService } from 'service/app-config.service';
import { ChatMessageService } from 'service/chat-message.service';
import { ContextMenuService } from 'service/context-menu.service';
import { ModalService } from 'service/modal.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { TabletopService } from 'service/tabletop.service';
import { SaveDataService } from 'service/save-data.service';
import { CommonActionService } from 'service/common-action.service';
import { SpectatorService } from 'service/spectator.service';
import raijin from 'json/raijin/raijin.json';
import { Piece } from 'models/piece';
import { GameConfigService } from 'service/game-config.service';
import { RaizanSetupService } from 'service/raizan-setup.service';  // ★これを追加
import { GameTable } from './class/game-table';
import { GameTableComponent } from './component/game-table/game-table.component';
import { RaizanSatoModalComponent, RaizanSatoResult } from 'component/raizan-sato-modal/raizan-sato-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy, OnInit {

  @ViewChild('modalLayer', { read: ViewContainerRef, static: true }) modalLayerViewContainerRef: ViewContainerRef;
  private immediateUpdateTimer: NodeJS.Timeout = null;
  private lazyUpdateTimer: NodeJS.Timeout = null;
  private openPanelCount: number = 0;
  isSaveing: boolean = false;
  progresPercent: number = 0;
  // フィールド
  showRaizanSettings = false;
  showSheetEditor = false; // ★追加（スプレッドシート操作モーダル）

  otonashiPieces: Piece[] = [];
  kotodamaPieces: Piece[] = [];
  ougiPieces: Piece[] = [];

  isViewRotated = false;
  viewRotateX = 0;
  viewRotateY = 0;
  viewRotateZ = 0;

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private chatMessageService: ChatMessageService,
    private tabletopService: TabletopService,
    private appConfigService: AppConfigService,
    private saveDataService: SaveDataService,
    private commonActionService: CommonActionService,
    private spectatorService: SpectatorService,
    private ngZone: NgZone,
    private gameConfig: GameConfigService,
    private raizanSetupService: RaizanSetupService, // ★追加
  ) {

    this.ngZone.runOutsideAngular(() => {
      EventSystem;
      Network;
      FileArchiver.instance.initialize();
      ImageSharingSystem.instance.initialize();
      ImageStorage.instance;
      AudioSharingSystem.instance.initialize();
      AudioStorage.instance;
      ObjectFactory.instance;
      ObjectSerializer.instance;
      ObjectStore.instance;
      ObjectSynchronizer.instance.initialize();
    });
    this.appConfigService.initialize();
    this.pointerDeviceService.initialize();

    TableSelecter.instance.initialize();
    ChatTabList.instance.initialize();
    DataSummarySetting.instance.initialize();

    let diceBot: DiceBot = new DiceBot('DiceBot');
    diceBot.initialize();
    DiceBot.getHelpMessage('').then(() => this.lazyNgZoneUpdate(true));

    let jukebox: Jukebox = new Jukebox('Jukebox');
    jukebox.initialize();

    let soundEffect: SoundEffect = new SoundEffect('SoundEffect');
    soundEffect.initialize();

    ChatTabList.instance.addChatTab('メインタブ', 'MainTab');
    ChatTabList.instance.addChatTab('ルームタブ', 'room-log');
    ChatTabList.instance.addChatTab('対戦ログ', 'game-log');

    let fileContexts: ImageContext[] = new Array(14);
    let IconImages: ImageFile[] = new Array(14)
    for (let i = 1; i <= 13; i++) {
      fileContexts[i] = ImageFile.createEmpty('icon[' + i + ']').toContext();
      fileContexts[i].url = './assets/images/raigo/Icons/Icon[' + i + '].png';
      IconImages[i] = ImageStorage.instance.add(fileContexts[i]);
    }

    AudioPlayer.resumeAudioContext();
    PresetSound.dicePick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.dicePut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.diceRoll1 = AudioStorage.instance.add('./assets/sounds/on-jin/spo_ge_saikoro_teburu01.mp3').identifier;
    PresetSound.diceRoll2 = AudioStorage.instance.add('./assets/sounds/on-jin/spo_ge_saikoro_teburu02.mp3').identifier;
    PresetSound.cardDraw = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/card-turn-over1.mp3').identifier;
    PresetSound.cardPick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.cardPut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.cardShuffle = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/card-open1.mp3').identifier;
    PresetSound.piecePick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.piecePut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.blockPick = AudioStorage.instance.add('./assets/sounds/tm2/tm2_pon002.wav').identifier;
    PresetSound.blockPut = AudioStorage.instance.add('./assets/sounds/tm2/tm2_pon002.wav').identifier;
    PresetSound.lock = AudioStorage.instance.add('./assets/sounds/tm2/tm2_switch001.wav').identifier;
    PresetSound.unlock = AudioStorage.instance.add('./assets/sounds/tm2/tm2_switch001.wav').identifier;
    PresetSound.sweep = AudioStorage.instance.add('./assets/sounds/tm2/tm2_swing003.wav').identifier;
    PresetSound.selectionStart = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/decision50.mp3').identifier;
    PresetSound.raigo = AudioStorage.instance.add('./assets/sounds/tm2/tm2_don19.wav').identifier;
    PresetSound.raijin = AudioStorage.instance.add('./assets/sounds/tm2/tm2_don09_a.wav').identifier;
    PresetSound.makimono = AudioStorage.instance.add('./assets/sounds/tm2/巻物開く音.mp3').identifier;
    PresetSound.raihou = AudioStorage.instance.add('./assets/sounds/tm2/塔解放時落雷.mp3').identifier;
    PresetSound.charge = AudioStorage.instance.add('./assets/sounds/tm2/陽玉蓄積音.mp3').identifier;
    PresetSound.on = AudioStorage.instance.add('./assets/sounds/tm2/隠駒.mp3').identifier;
    PresetSound.godeye = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/和太鼓でカカッ.mp3').identifier;
    PresetSound.chat = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/キャンセル4.mp3').identifier;
    PresetSound.enter = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/鈴を鳴らす.mp3').identifier;
    PresetSound.bgm1 = AudioStorage.instance.add('./assets/sounds/dova/陰影.mp3').identifier;
    PresetSound.bgm2 = AudioStorage.instance.add('./assets/sounds/amca/「夜半ノ月」～夜道.mp3').identifier;
    PresetSound.bgm3 = AudioStorage.instance.add('./assets/sounds/amca/お地蔵様のいる小道.mp3').identifier;
    PresetSound.bgm4 = AudioStorage.instance.add('./assets/sounds/amca/ネオンパープル.mp3').identifier;
    PresetSound.bgm5 = AudioStorage.instance.add('./assets/sounds/amca/ミスト.mp3').identifier;
    //PresetSound.bgm6 = AudioStorage.instance.add('./assets/sounds/amca/傾きかけた日差し.mp3').identifier;
    PresetSound.bgm7 = AudioStorage.instance.add('./assets/sounds/amca/孤独とささやき.mp3').identifier;
    PresetSound.bgm8 = AudioStorage.instance.add('./assets/sounds/amca/悠久の時へ.mp3').identifier;
    PresetSound.bgm9 = AudioStorage.instance.add('./assets/sounds/amca/桜雲.mp3').identifier;
    PresetSound.bgm10 = AudioStorage.instance.add('./assets/sounds/amca/神々の宿る場所.mp3').identifier;
    PresetSound.bgm11 = AudioStorage.instance.add('./assets/sounds/amca/緩やかな風.mp3').identifier;

    AudioStorage.instance.get(PresetSound.dicePick).isHidden = true;
    AudioStorage.instance.get(PresetSound.dicePut).isHidden = true;
    AudioStorage.instance.get(PresetSound.diceRoll1).isHidden = true;
    AudioStorage.instance.get(PresetSound.diceRoll2).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardDraw).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardPick).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardPut).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardShuffle).isHidden = true;
    AudioStorage.instance.get(PresetSound.piecePick).isHidden = true;
    AudioStorage.instance.get(PresetSound.piecePut).isHidden = true;
    AudioStorage.instance.get(PresetSound.blockPick).isHidden = true;
    AudioStorage.instance.get(PresetSound.blockPut).isHidden = true;
    AudioStorage.instance.get(PresetSound.lock).isHidden = true;
    AudioStorage.instance.get(PresetSound.unlock).isHidden = true;
    AudioStorage.instance.get(PresetSound.sweep).isHidden = true;
    AudioStorage.instance.get(PresetSound.selectionStart).isHidden = true;
    AudioStorage.instance.get(PresetSound.raigo).isHidden = true;
    AudioStorage.instance.get(PresetSound.raijin).isHidden = true;
    AudioStorage.instance.get(PresetSound.makimono).isHidden = true;
    AudioStorage.instance.get(PresetSound.raihou).isHidden = true;
    AudioStorage.instance.get(PresetSound.charge).isHidden = true;
    AudioStorage.instance.get(PresetSound.on).isHidden = true;
    AudioStorage.instance.get(PresetSound.godeye).isHidden = true;
    AudioStorage.instance.get(PresetSound.chat).isHidden = true;
    AudioStorage.instance.get(PresetSound.enter).isHidden = true;
    AudioStorage.instance.get(PresetSound.bgm1).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm2).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm3).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm4).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm5).isHidden = false;
    //AudioStorage.instance.get(PresetSound.bgm6).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm7).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm8).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm9).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm10).isHidden = false;
    AudioStorage.instance.get(PresetSound.bgm11).isHidden = false;

    let randomvalue = this.commonActionService.getRandomvalue(1, 13);
    let familyCode = this.commonActionService.getFamilyCode(randomvalue);

    PeerCursor.createMyCursor();
    const params = new URLSearchParams(window.location.search);
    const name = (params.get('name') ?? '').trim();

    PeerCursor.myCursor.name = name || '名も無き雷人';
    PeerCursor.myCursor.update?.();    PeerCursor.myCursor.imageIdentifier = IconImages[randomvalue].identifier;

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('DELETE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('UPDATE_SELECTION', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('SYNCHRONIZE_AUDIO_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on('SYNCHRONIZE_FILE_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on<AppConfig>('LOAD_CONFIG', event => {
        console.log('LOAD_CONFIG !!!');
        Network.configure(event.data);
        Network.open();
      })
      .on<File>('FILE_LOADED', event => {
        this.lazyNgZoneUpdate(false);
      })
      .on('OPEN_NETWORK', event => {
        console.log('OPEN_NETWORK', event.data.peerId);
        PeerCursor.myCursor.peerId = Network.peer.peerId;
        PeerCursor.myCursor.userId = Network.peer.userId;
      })
      .on('NETWORK_ERROR', event => {
        console.log('NETWORK_ERROR', event.data.peerId);
        let errorType: string = event.data.errorType;
        let errorMessage: string = event.data.errorMessage;

        this.ngZone.run(async () => {
          //SKyWayエラーハンドリング
          let quietErrorTypes = ['peer-unavailable'];
          let reconnectErrorTypes = ['disconnected', 'socket-error', 'unavailable-id', 'authentication', 'server-error'];

          if (quietErrorTypes.includes(errorType)) return;
          await this.modalService.open(TextViewComponent, { title: 'ネットワークエラー', text: errorMessage });

          if (!reconnectErrorTypes.includes(errorType)) return;
          await this.modalService.open(TextViewComponent, { title: 'ネットワークエラー', text: 'このウィンドウを閉じると再接続を試みます。' });
          Network.open();
        });
      })
      .on('CONNECT_PEER', event => {
        if (event.isSendFromSelf) this.chatMessageService.calibrateTimeOffset();
        this.lazyNgZoneUpdate(event.isSendFromSelf);
      })
      .on('DISCONNECT_PEER', event => {
        this.lazyNgZoneUpdate(event.isSendFromSelf);
      });

    workaroundForMobileSafari();
  }

  ngAfterViewInit() {
    PanelService.defaultParentViewContainerRef = ModalService.defaultParentViewContainerRef = ContextMenuService.defaultParentViewContainerRef = this.modalLayerViewContainerRef;
    setTimeout(() => {
      // this.panelService.open(PeerMenuComponent, { width: 500, height: 450, left: 100 });
      // this.panelService.open(ChatWindowComponent, { width: 700, height: 400, left: 100, top: 450 });
      //this.modalService.open(LobbyComponent, { width: 700, height: 400, left: (window.innerWidth - 700) / 2, top: (window.innerHeight - 400) / 2 });
    }, 0);
  }

  get isSpectator(): boolean {
    return this.spectatorService.enabled;
  }
  get unreadChatCount(): number {
    // ChatMessageService の chatTabs 経由で全チャットタブにアクセス
    const tabs = this.chatMessageService.chatTabs || [];
    return tabs.reduce((sum, tab: any) => {
      // ChatTab.unreadLength を合計（公式 udonarium と同じプロパティ名）
      return sum + (tab.unreadLength || 0);
    }, 0);
  }

  onToggleSpectator(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.spectatorService.enabled = checked;
    EventSystem.trigger('RAIGO_SPECTATOR_CHANGED', { enabled: checked });
  }

  // 観戦開始ボタン（ボタンB）を押したとき
  onClickBecomeSpectator(): void {
    const ok = window.confirm('本当によろしいですか？\n観戦者になると全ての駒の表が見えるようになります。');
    if (!ok) return;

    this.spectatorService.enabled = true;
    EventSystem.trigger('RAIGO_SPECTATOR_CHANGED', { enabled: true });

    this.postSpectatorLog();
  }

  // 観戦解除ボタン（ボタンA）を押したとき
  onClickLeaveSpectator(): void {
    this.spectatorService.enabled = false;
    EventSystem.trigger('RAIGO_SPECTATOR_CHANGED', { enabled: false });
  }

  // 観戦者になったことを対戦ログに出す
  private postSpectatorLog(): void {
    const tabList = ChatTabList.instance;
    if (!tabList || !tabList.chatTabs.length) return;

    const roomlog =
      tabList.chatTabs.find(t => t.name === 'ルームタブ') ??
      tabList.chatTabs[0];

    if (!roomlog) return;

    const cursor = PeerCursor.myCursor;
    const name = cursor?.name || 'プレイヤー';
    const from = cursor?.identifier ?? '';

    const text = `${name} が観戦者になりました`;

    this.chatMessageService.sendMessage(
      roomlog,
      text,
      'system',   // gameType / sendFrom は既存実装に合わせてOK
      from,
      null
    );
  }

  // 起動時に JSON を読む
  ngOnInit(): void {
    this.gameConfig.loadAllPieces().subscribe(({ otonashi, kotodama, ougi }) => {
      this.otonashiPieces = otonashi;
      this.kotodamaPieces = kotodama;
      this.ougiPieces = ougi;
    });
    //this.route.queryParamMap.subscribe(params => {
    //  const name = (params.get('name') ?? '').trim();

    //  // 空なら既定値
    //  PeerCursor.myCursor.name = name || '名も無き雷人';
    //});
  }

  // メニューから開閉
  openRaizanSettings() {
    this.showRaizanSettings = true;
  }

  closeRaizanSettings() {
    this.showRaizanSettings = false;
  }

  // ★追加：結果報告（シート操作）モーダル
  openSheetEditor() {
    this.showSheetEditor = true;
  }

  closeSheetEditor() {        // ★これを追加
    this.showSheetEditor = false;
  }

  onraizanSettingsSave(event: {
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
  }) {
    // モーダルから受け取った設定でローカル状態も更新しておく
    this.otonashiPieces = event.otonashi;
    this.kotodamaPieces = event.kotodama;
    this.ougiPieces = event.ougi;

    // ★枚数つきの設定をそのままサービスに渡して雷山生成
    this.raizanSetupService.setupRaizanFromSettings({
      otonashi: this.otonashiPieces,
      kotodama: this.kotodamaPieces,
      ougi: this.ougiPieces,
    });

    this.closeRaizanSettings();
  }

  onPlaceOugiToTsuki(event: { ougiPieces: Piece[] }): void {
    if (!event || !event.ougiPieces || event.ougiPieces.length === 0) {
      return;
    }

    // 雷神戦モードの「月に置く」イベントをサービスへ委譲
    this.raizanSetupService.placeOugiToTsuki(event.ougiPieces);
  }

  // 隠駒terrainへ状態を寄せられる場合は寄せる（未実装でも壊れないようにanyで）
  private getOngomaTerrain(): Terrain | null {
    const terrains = this.tabletopService?.terrains ?? [];
    return terrains.find(t => (t.name ?? '').includes('隠駒') || (t.name ?? '').toLowerCase().includes('ongoma')) ?? null;
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  open(componentName: string) {
    let component: { new(...args: any[]): any } = null;
    let option: PanelOption = { width: 450, height: 600, left: 100 }
    switch (componentName) {
      case 'PeerMenuComponent':
        component = PeerMenuComponent;
        break;
      case 'ChatWindowComponent':
        component = ChatWindowComponent;
        option.width = 700;
        break;
      case 'GameTableSettingComponent':
        component = GameTableSettingComponent;
        option = { width: 630, height: 400, left: 100 };
        break;
      case 'FileStorageComponent':
        component = FileStorageComponent;
        break;
      case 'GameCharacterSheetComponent':
        component = GameCharacterSheetComponent;
        break;
      case 'JukeboxComponent':
        component = JukeboxComponent;
        break;
      case 'GameObjectInventoryComponent':
        component = GameObjectInventoryComponent;
        break;
      case 'LobbyComponent':
        component = LobbyComponent;
        option = { width: 700, height: 400, left: (window.innerWidth - 700) / 2, top: (window.innerHeight - 400) / 2 };
        break;
    }
    if (component) {
      option.top = (this.openPanelCount % 10 + 1) * 20;
      option.left = 100 + (this.openPanelCount % 20 + 1) * 5;
      this.openPanelCount = this.openPanelCount + 1;
      this.panelService.open(component, option);
    }
  }

  async save() {
    if (this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    let roomName = 0 < Network.peer.roomName.length
      ? Network.peer.roomName
      : 'ルームデータ';
    await this.saveDataService.saveRoomAsync(roomName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  handleFileSelect(event: Event) {
    let input = <HTMLInputElement>event.target;
    let files = input.files;
    if (files.length) FileArchiver.instance.load(files);
    input.value = '';
  }

  private lazyNgZoneUpdate(isImmediate: boolean) {
    if (isImmediate) {
      if (this.immediateUpdateTimer !== null) return;
      this.immediateUpdateTimer = setTimeout(() => {
        this.immediateUpdateTimer = null;
        if (this.lazyUpdateTimer != null) {
          clearTimeout(this.lazyUpdateTimer);
          this.lazyUpdateTimer = null;
        }
        this.ngZone.run(() => { });
      }, 0);
    } else {
      if (this.lazyUpdateTimer !== null) return;
      this.lazyUpdateTimer = setTimeout(() => {
        this.lazyUpdateTimer = null;
        if (this.immediateUpdateTimer != null) {
          clearTimeout(this.immediateUpdateTimer);
          this.immediateUpdateTimer = null;
        }
        this.ngZone.run(() => { });
      }, 100);
    }
  }

  // ★あなたのPHP(sheep-proxy.php)のURLに変更
  private readonly sheetApiBaseUrl = 'https://mitarashi.link/api/sheet-proxy.php';

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]); // data:...;base64,xxxx の xxxx
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async uploadTournamentResultMenu(): Promise<void> {
    // ひとまず固定でOK（あとでモーダルで選択にする）
    const baseName = '対戦ログ';
    const tournamentId = '1';
    const matchId = 'manual';

    const { url } = await this.uploadTournamentResult(baseName, tournamentId, matchId);
    console.log('uploaded:', url);
    alert(`アップロードしました\n${url}`);
  }

  /**
   * 大会結果ZIPを生成→GASへアップロードしてURLを返す
   * baseName: ZIP名のベース（例 "雷轟_結果"）
   */
  async uploadTournamentResult(
    baseName: string,
    tournamentId: string,
    matchId: string
  ):
    Promise<{ url: string }> {
    if (this.isSaveing) {
      console.warn('busy');
      return { url: '' };
    }
    this.isSaveing = true;
    this.progresPercent = 0;


    try {
      // 1) ZIPをBlobで生成（SaveDataService側）
      const { fileName, blob } = await this.saveDataService.buildTournamentZipAsync(
        baseName,
        (p: number) => (this.progresPercent = p)
      );

      const round = 1;          // まずは固定（あとで実値に）
      const tableName = 'A01';  // まずは固定（あとで実値に）
      const matchId = await this.findSwissMatchId(tournamentId, round, tableName);

      // 2) Base64化
      const base64 = await this.blobToBase64(blob);

      //const base64 = btoa('hello'); // 超小さい
      // 3) GASへPOST（PHP経由）
      const res = await fetch(this.sheetApiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadLog',
          fileName: `${fileName}_${tournamentId}_${matchId}`,
          base64,
        }),
      });

      const raw = await res.text();
      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        console.error('upload raw response:', raw.slice(0, 800));
        throw new Error('non-JSON response from upstream');
      }

      if (!json?.ok) {
        console.error('uploadLog failed:', json);
        throw new Error(`${json?.error || 'upload failed'}: ${json?.message || ''}`);
      }

      // ★アップロードが「成功」した直後に、matchIdでログURLを紐づける


      const r2 = await fetch(this.sheetApiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSwissLog',
          matchId,
          logZipUrl: json.url,
        }),
      });

      const t2 = await r2.text();
      let j2: any;
      try {
        j2 = JSON.parse(t2);
      } catch {
        console.error('updateSwissLog raw response:', t2.slice(0, 800));
        throw new Error('updateSwissLog non-JSON response');
      }

      if (!j2.ok) {
        console.error('updateSwissLog failed:', j2);
        throw new Error(j2.error || j2.message || 'updateSwissLog failed');
      }

      return { url: json.url as string };
    } finally {
      setTimeout(() => {
        this.isSaveing = false;
        this.progresPercent = 0;
      }, 500);
    }
  }
  private normTableName(v: string): string {
    const s = (v ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const m = s.match(/^([A-Z]+)0*(\d+)$/); // A01/A1 を同一視（A1へ）
    if (m) return `${m[1]}${parseInt(m[2], 10)}`;
    return s;
  }

  private async fetchSwissMatches(tournamentId: string): Promise<any[]> {
    const tryFetch = async (tid: string) => {
      const url = `${this.sheetApiBaseUrl}?action=swiss&tournamentId=${encodeURIComponent(tid)}`;
      const r = await fetch(url);
      const raw = await r.text();
      let j: any;
      try { j = JSON.parse(raw); } catch {
        console.error('getSwiss raw response:', raw.slice(0, 800));
        throw new Error('getSwiss non-JSON response');
      }
      if (!j.ok) throw new Error(j.error || j.message || 'getSwiss failed');
      return (j.matches ?? j.rows ?? []) as any[];
    };

    // 1回目：そのまま
    let matches = await tryFetch(String(tournamentId));

    // 2回目：もし空で、数値IDなら t001 形式も試す（シートが t001 の場合の保険）
    if (matches.length === 0 && /^\d+$/.test(String(tournamentId))) {
      const padded = String(tournamentId).padStart(3, '0');
      matches = await tryFetch(`t${padded}`);
    }

    return matches;
  }

  private async findSwissMatchId(tournamentId: string, round: number, tableName: string): Promise<string> {
    const matches = await this.fetchSwissMatches(String(tournamentId));
    const target = matches.find(m =>
      Number(m.round) === Number(round) &&
      this.normTableName(String(m.tableName || '')) === this.normTableName(String(tableName || ''))
    );

    if (!target?.matchId) {
      console.error('match not found', { tournamentId, round, tableName, matches });
      throw new Error('match not found');
    }
    return String(target.matchId);
  }

  async openRaigoPortal(): Promise<void> {
    const width = 820;
    const height = 640;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const result = await this.modalService.open<RaizanSatoResult>(
      RaizanSatoModalComponent,
      { width, height, left, top }
    );

    if (!result) return;

    // モーダル側で「大会へ」などを押した時の戻り値に応じて動作させる
    if (result.action === 'OPEN_TOURNAMENT_HALL') {
      // 既存の「大会エントリー」モーダルへ接続（必要なら member をサービス経由で渡す）
      this.openSheetEditor();
    }
  }
}

PanelService.UIPanelComponentClass = UIPanelComponent;
ContextMenuService.ContextMenuComponentClass = ContextMenuComponent;
ModalService.ModalComponentClass = ModalComponent;

function workaroundForMobileSafari() {
  // Mobile Safari (iOS 16.4)で確認した問題のworkaround.
  // chrome-smooth-image-trickがCSSアニメーション（keyframes）の挙動に悪影響を与えるので修正用CSSで上書きする.
  let ua = window.navigator.userAgent.toLowerCase();
  let isiOS = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('macintosh') > -1 && 'ontouchend' in document;
  if (isiOS) {
    let style = document.createElement('style');
    style.innerHTML = `
      .chrome-smooth-image-trick {
        transform-style: flat;
      }
      `;
    document.body.appendChild(style);
  }
}
