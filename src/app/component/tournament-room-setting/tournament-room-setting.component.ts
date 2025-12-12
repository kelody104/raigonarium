// src/app/component/tournament-room-setting/tournament-room-setting.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';

import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from 'src/app/class/core/system/network/peer-context';
import { PeerCursor } from 'src/app/class/peer-cursor';
import { PanelService } from 'src/app/service/panel.service';
import { ModalService } from 'src/app/service/modal.service';

// JSON 読み込み
import EVENT_JSON from 'src/assets/json/event/event.json';
import ROOM_JSON from 'src/assets/json/event/room.json';

interface TournamentEvent {
  name: string;
  entrylist: string[];
  roomCode: string;
}

interface TournamentRoom {
  name: string;
  discordwebhook: string;
  peerId: string;  // ← 追加
}

@Component({
  selector: 'tournament-room-setting',
  templateUrl: './tournament-room-setting.component.html',
  styleUrls: ['./tournament-room-setting.component.css']
})
export class TournamentRoomSettingComponent implements OnInit, OnDestroy {

  events: TournamentEvent[] = (EVENT_JSON as any).event || [];
  rooms: TournamentRoom[] = (ROOM_JSON as any).room || [];

  selectedEventIndex: number = 0;
  selectedRoomIndex: number = 0;

  readonly maxPlayers = 3;  // 大会用は 3 人固定

  constructor(
    private panelService: PanelService,
    private modalService: ModalService
  ) { }

  get peerId(): string { return Network.peerId; }

  ngOnInit(): void {
    Promise.resolve().then(() =>
      this.modalService.title = this.panelService.title = '大会用ルームを作成'
    );
    EventSystem.register(this);
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  private buildInternalRoomName(baseName: string): string {
    // ルーム名 + [3] 形式にして最大人数を埋め込む
    return `${baseName}`;
  }

  createTournamentRoom(): void {
    const event = this.events[this.selectedEventIndex];
    const room = this.rooms[this.selectedRoomIndex];

    if (!event || !room) return;

    const baseName = `${event.name} ${room.name}`;
    const internalName = this.buildInternalRoomName(baseName);

    const userId = Network.peer.userId;
    const peerId = event.roomCode + room.peerId;

    // パスワードなし・3人固定
    Network.open(userId, peerId, internalName, '');
    PeerCursor.myCursor.peerId = Network.peerId;

    this.modalService.resolve(true);
  }

  cancel(): void {
    this.modalService.resolve(false);
  }
}
