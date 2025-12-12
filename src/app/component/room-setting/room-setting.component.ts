import { Component, OnDestroy, OnInit } from '@angular/core';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { PeerCursor } from '@udonarium/peer-cursor';

import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';

@Component({
  selector: 'room-setting',
  templateUrl: './room-setting.component.html',
  styleUrls: ['./room-setting.component.css']
})
export class RoomSettingComponent implements OnInit, OnDestroy {
  peers: PeerContext[] = [];
  isReloading: boolean = false;

  roomName: string = '雷轟手合わせ部屋';
  password: string = '';
  isPrivate: boolean = false;
  maxPlayers: number = 4; // ★追加：入室可能人数（初期値 4）

  get peerId(): string { return Network.peerId; }
  get isConnected(): boolean { return 0 < Network.peerIds.length; }
  validateLength: boolean = false;

  constructor(
    private panelService: PanelService,
    private modalService: ModalService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = 'ルーム作成');
    EventSystem.register(this);
    this.calcPeerId(this.roomName, this.password);
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  // ★追加：内部用のルーム名を生成（例: "テスト部屋[4]"）
  private buildInternalRoomName(roomName: string, maxPlayers: number): string {
    const num = Number(maxPlayers);
    if (!num || num <= 0) return roomName;
    return `${roomName}`; // 例: 雷語手合わせ部屋
  }

  calcPeerId(roomName: string, password: string) {
    const userId = Network.peer.userId;
    const internalName = this.buildInternalRoomName(roomName, this.maxPlayers);
    const peer = PeerContext.create(userId, PeerContext.generateId('****'), internalName, password);
    this.validateLength = peer.peerId.length < 64;
  }

  createRoom() {
    const userId = Network.peer.userId;
    const internalName = this.buildInternalRoomName(this.roomName, this.maxPlayers);

    Network.open(userId, PeerContext.generateId('***'), internalName, this.password);
    PeerCursor.myCursor.peerId = Network.peerId;

    this.modalService.resolve(true);
  }
}
