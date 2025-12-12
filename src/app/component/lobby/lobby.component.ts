import { Component, OnDestroy, OnInit } from '@angular/core';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { IRoomInfo } from '@udonarium/core/system/network/room-info';
import { PeerCursor } from '@udonarium/peer-cursor';

import { PasswordCheckComponent } from 'component/password-check/password-check.component';
import { RoomSettingComponent } from 'component/room-setting/room-setting.component';
import { TournamentRoomSettingComponent } from '../tournament-room-setting/tournament-room-setting.component';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';

@Component({
  selector: 'lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css'],
})
export class LobbyComponent implements OnInit, OnDestroy {
  rooms: IRoomInfo[] = [];

  isReloading: boolean = false;

  help: string = '「一覧を更新」ボタンを押すと接続可能なルーム一覧を表示します。';

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

  // ★追加：接続してよいか（満室なら false）
  canConnect(room: IRoomInfo): boolean {
    const capacity = this.getRoomCapacity(room);
    if (capacity == null) return true;    // 制限なしなら常にOK
    return room.peers.length < capacity;  // 現在人数 < 最大人数 のときのみOK
  }

  constructor(
    private panelService: PanelService,
    private modalService: ModalService
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
}
