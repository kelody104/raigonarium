import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { IRoomInfo } from '@udonarium/core/system/network/room-info';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PasswordCheckComponent } from 'component/password-check/password-check.component';
import { RoomSettingComponent } from 'component/room-setting/room-setting.component';
import { TournamentRoomSettingComponent } from '../tournament-room-setting/tournament-room-setting.component';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { PeerSessionGrade } from '@udonarium/core/system/network/peer-session-state';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { AppConfig, AppConfigService } from 'service/app-config.service';
import { Tournament, Entry } from 'src/app/models/tournament-models';
import { TournamentHallModalComponent } from '../tournament-hall-modal/tournament-hall-modal.component';
import { TournamentBoardModalComponent } from '../tournament-board-modal/tournament-board-modal.component';
import { RaizanSatoModalComponent, RaizanSatoResult } from '../raizan-sato-modal/raizan-sato-modal.component';

@Component({
  selector: 'lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css'],
})
export class LobbyComponent implements OnInit, OnDestroy {
  rooms: IRoomInfo[] = [];

  isReloading: boolean = false;

  help: string = '「一覧を更新」ボタンを押すと接続可能なルーム一覧を表示します。';

  //===============接続情報==================
  targetUserId: string = '';
  networkService = Network;
  gameRoomService = ObjectStore.instance;
  helpPeer: string = '';
  isPasswordVisible = false;

  // 追加プロパティ（大会）
  isTournamentHallOpen = false;
  isTournamentBoardOpen = false;
  selectedTournament?: Tournament;
  enterMode: 'PLAYER' | 'WATCHER' = 'WATCHER';
  enteredEntry?: Entry;
  @ViewChild(TournamentHallModalComponent) tournamentHall?: TournamentHallModalComponent;
  @ViewChild(TournamentBoardModalComponent) tournamentBoard?: TournamentBoardModalComponent;

  get currentRoom(): string { return Network.peer.roomId };
  get peerId(): string { return Network.peerId; }
  get isConnected(): boolean { return 0 < Network.peerIds.length; }

  // ★追加：内部名 "テスト部屋[4]" から 4 を取り出す
  getRoomCapacity(room: IRoomInfo): number | null {
    const name = room.name || '';
    const match = name.match(/\[(\d+)\]$/);
    return match ? Number(match[1]) : null;
  }

  // ★追加：表示用ルーム名（[4] を取り除いたもの）
  getRoomDisplayName(room: IRoomInfo): string {
    return (room.name || '').replace(/\[(\d+)\]$/, '');
  }

  //===============接続情報==================
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get config(): AppConfig { return AppConfigService.appConfig; }
  get canUsePrivateSession(): boolean { return this.config.backend.mode == 'skyway'; }

  findUserId(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.userId : '';
  }

  findPeerName(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.name : '';
  }

  stringFromSessionGrade(grade: PeerSessionGrade): string {
    return PeerSessionGrade[grade] ?? PeerSessionGrade[PeerSessionGrade.UNSPECIFIED];
  }

  togglePasswordVisibility() { this.isPasswordVisible = !this.isPasswordVisible; }

  // ★追加：接続してよいか（満室なら false）
  canConnect(room: IRoomInfo): boolean {
    const capacity = this.getRoomCapacity(room);
    if (capacity == null) return true;    // 制限なしなら常にOK
    return room.peers.length < capacity;  // 現在人数 < 最大人数 のときのみOK
  }

  constructor(
    private panelService: PanelService,
    private modalService: ModalService,
    public appConfigService: AppConfigService,
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.changeTitle());
    EventSystem.register(this)
      .on('OPEN_NETWORK', event => {
        this.changeTitle();
      })
      .on('CONNECT_PEER', event => {
        this.changeTitle();
      });
    this.reload();
  }

  private changeTitle() {
    this.modalService.title = this.panelService.title = 'ロビー';
    if (Network.peer.roomName.length) {
      this.modalService.title = this.panelService.title = '＜' + Network.peer.roomName + '/' + Network.peer.roomId + '＞'
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  async reload() {
    this.isReloading = true;
    this.help = '検索中...';
    this.rooms = await Network.listAllRooms();
    this.help = '接続可能なルームが見つかりませんでした。「新しいルームを作成する」で新規ルームを作成できます。';
    this.isReloading = false;
  }

  async connect(room: IRoomInfo) {
    // ★追加：満室なら何もしない
    if (!this.canConnect(room)) return;

    let password = '';

    if (room.hasPassword) {
      password = await this.modalService.open<string>(PasswordCheckComponent, { peers: room.peers, title: `${room.name}/${room.id}` });
      if (password == null) password = '';
    }

    let targetPeers = room.filterByPassword(password);
    if (targetPeers.length < 1) return;

    let userId = Network.peer.userId;
    Network.open(userId, room.id, room.name, password);
    PeerCursor.myCursor.peerId = Network.peerId;

    let triedPeer: string[] = [];

    let onTried = () => {
      if (triedPeer.length < targetPeers.length) return false;
      this.resetNetwork();
      EventSystem.unregister(triedPeer);
      this.closeIfConnected();
      return true;
    }
    let onConnect = (peerId) => {
      console.log('接続成功！', peerId);
      triedPeer.push(peerId);
      console.log('接続成功 ' + triedPeer.length + '/' + targetPeers.length);
      return onTried();
    }
    let onDisconnect = (peerId) => {
      console.warn('接続失敗', peerId);
      triedPeer.push(peerId);
      console.warn('接続失敗 ' + triedPeer.length + '/' + targetPeers.length);
      return onTried();
    }

    EventSystem.register(triedPeer)
      .on('OPEN_NETWORK', event => {
        console.log('LobbyComponent OPEN_PEER', event.data.peerId);
        EventSystem.unregister(triedPeer);
        ObjectStore.instance.clearDeleteHistory();
        for (let peer of targetPeers) {
          if (!Network.connect(peer) && onDisconnect(peer.peerId)) return;
        }
        EventSystem.register(triedPeer)
          .on('CONNECT_PEER', event => onConnect(event.data.peerId))
          .on('DISCONNECT_PEER', event => onDisconnect(event.data.peerId));
      });
  }

  private resetNetwork() {
    if (Network.peers.length < 1) {
      Network.open();
      PeerCursor.myCursor.peerId = Network.peerId;
    }
  }

  private closeIfConnected() {
    if (0 < Network.peers.length) this.modalService.resolve();
  }

  async showRoomSetting() {
    let isCreate = await this.modalService.open(RoomSettingComponent, { width: 700, height: 400, left: 0, top: 400 });
    if (isCreate) this.modalService.resolve();
    this.help = '「一覧を更新」ボタンを押すと接続可能なルーム一覧を表示します。';
  }

  // ★追加
  showTournamentRoomSetting() {
    const width = 500;
    const height = 220;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    this.modalService.open(TournamentRoomSettingComponent, { width, height, left, top });
  }

  //===============接続情報==================
  changeIcon() {
    this.modalService.open<string>(FileSelecterComponent).then(value => {
      if (!this.myPeer || !value) return;
      this.myPeer.imageIdentifier = value;
    });
  }

  connectPeer() {
    let targetUserId = this.targetUserId;
    this.targetUserId = '';
    if (targetUserId.length < 1) return;
    this.helpPeer = '';
    let peer = PeerContext.create(targetUserId);
    if (peer.isRoom) return;
    ObjectStore.instance.clearDeleteHistory();
    Network.connect(peer);
  }

  //===============雷山の里==================
  async openRaizanSato() {
    const width = 560;
    const height = 420;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const result = await this.modalService.open<RaizanSatoResult>(RaizanSatoModalComponent, { width, height, left, top });
    if (result?.action === 'OPEN_TOURNAMENT_HALL') {
      this.openTournamentHall();
    }
  }

  //===============大会情報==================
  openTournamentHall() {
    this.isTournamentHallOpen = true;
    setTimeout(() => (this as any).tournamentHall?.onOpen?.(), 0);
  }

  onTournamentHallClose() {
    this.isTournamentHallOpen = false;
  }

  onEntered(ev: { tournament: Tournament; mode: 'PLAYER' | 'WATCHER'; entry?: Entry }) {
    this.isTournamentHallOpen = false;

    this.selectedTournament = ev.tournament;
    this.enterMode = ev.mode;
    this.enteredEntry = ev.entry;

    this.isTournamentBoardOpen = true;
    setTimeout(() => (this as any).tournamentBoard?.onOpen?.(), 0);
  }

  onTournamentBoardClose() {
    this.isTournamentBoardOpen = false;
  }
}
