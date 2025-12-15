import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { IRoomInfo } from '@udonarium/core/system/network/room-info';

import { TournamentSheetService } from '../../service/tournament-sheet.service';
import { TournamentViewService } from '../../service/tournament-view.service';
import { BracketCellVM, Entry, SwissRoundVM, Tournament } from '../../models/tournament-models';

@Component({
  selector: 'app-tournament-board-modal',
  templateUrl: './tournament-board-modal.component.html',
  styleUrls: ['./tournament-board-modal.component.scss'],
})
export class TournamentBoardModalComponent {
  @Input() isOpen = false;
  @Input() tournament!: Tournament;
  @Input() mode: 'PLAYER' | 'WATCHER' = 'WATCHER';
  @Input() entry?: Entry;

  @Output() close = new EventEmitter<void>();

  swissRounds: SwissRoundVM[] = [];
  bracketCells: BracketCellVM[] = [];

  loading = false;
  error = '';

  private loadingOnce = false;

  // 参加者が入れる卓（tableName=roomId）
  private myTables = new Set<string>();

  constructor(
    private sheet: TournamentSheetService,
    public view: TournamentViewService
  ) { }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['isOpen']?.currentValue === true) {
      await this.onOpen();
    }
    if (changes['isOpen']?.currentValue === false) {
      this.loadingOnce = false;
    }
  }

  async onOpen(): Promise<void> {
    if (!this.isOpen || !this.tournament) return;
    if (this.loading || this.loadingOnce) return;

    this.loadingOnce = true;
    this.loading = true;
    this.error = '';

    try {
      const tid = this.tournament.tournamentId;

      const [entries, swissMatches, bracketMatches] = await Promise.all([
        this.sheet.getEntries(tid),
        this.sheet.getSwissMatches(tid),
        this.sheet.getBracketMatches(tid),
      ]);

      this.swissRounds = this.view.buildSwissRounds(entries, swissMatches);
      this.bracketCells = this.view.buildBracketCells(entries, bracketMatches);
    } catch {
      this.error = '対戦表の取得に失敗しました。';
    } finally {
      this.loading = false;
    }

    this.rebuildMyTables();
  }

  onCancel(): void {
    this.close.emit();
  }

  // =========================
  // 入室（作成 or 合流）
  // =========================
  async enterTable(tableName: string): Promise<void> {
    const roomId = this.normalizeRoomId3(tableName);
    const roomName = `${this.tournament.name}`;
    const password = '';

    // 参加者は自卓のみ
    const isPlayer = this.mode === 'PLAYER' && !!this.entry?.playerId;
    if (isPlayer && !this.isMyTable(roomId)) {
      alert('あなたの卓ではありません');
      return;
    }

    await this.enterRoomById(roomId, roomName, password);

    // 入室できたら閉じる
    this.close.emit();
  }

  /**
   * roomId の部屋に「存在すれば合流、なければ作成」する
   */
  private async enterRoomById(roomId: string, roomName: string, password: string): Promise<void> {
    const rooms = await Network.listAllRooms();
    const found = rooms.find((r) => r.id === roomId);

    if (found) {
      await this.joinExistingRoom(found, password);
    } else {
      this.createAndOpenRoom(roomId, roomName, password);
    }
  }

  private normalizeRoomId3(tableName: string): string {
    const id = (tableName ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_]{3}$/.test(id)) {
      throw new Error(`卓IDが不正です: "${tableName}"（例: A01）`);
    }
    return id;
  }

  private createAndOpenRoom(roomId: string, roomName: string, password: string): void {
    const userId = Network.peer.userId;
    Network.open(userId, roomId, roomName, password);
    PeerCursor.myCursor.peerId = Network.peerId;
  }

  private async joinExistingRoom(room: IRoomInfo, password: string): Promise<void> {
    // LobbyComponent.connect と同じ流れ（passwordなし版）
    const targetPeers = room.filterByPassword(password);
    if (targetPeers.length < 1) return;

    const userId = Network.peer.userId;
    Network.open(userId, room.id, room.name, password);
    PeerCursor.myCursor.peerId = Network.peerId;

    const triedPeer: string[] = [];

    const onTried = () => {
      if (triedPeer.length < targetPeers.length) return false;
      if (Network.peers.length < 1) {
        Network.open();
        PeerCursor.myCursor.peerId = Network.peerId;
      }
      EventSystem.unregister(triedPeer);
      return true;
    };

    const onConnect = (peerId: string) => {
      triedPeer.push(peerId);
      return onTried();
    };

    const onDisconnect = (peerId: string) => {
      triedPeer.push(peerId);
      return onTried();
    };

    EventSystem.register(triedPeer).on('OPEN_NETWORK', (_) => {
      EventSystem.unregister(triedPeer);

      for (const peer of targetPeers) {
        if (!Network.connect(peer) && onDisconnect(peer.peerId)) return;
      }

      EventSystem.register(triedPeer)
        .on('CONNECT_PEER', (ev) => onConnect(ev.data.peerId))
        .on('DISCONNECT_PEER', (ev) => onDisconnect(ev.data.peerId));
    });
  }

  // =========================
  // 結果（ダミー）
  // =========================
  openResult(zipUrl?: string): void {
    console.log('[RESULT]', zipUrl);
  }

  openLatestGameResult(cell: BracketCellVM): void {
    const urls = (cell.games ?? [])
      .map((g) => g.logZipUrl)
      .filter((u): u is string => !!u);
    const latest = urls[urls.length - 1];
    this.openResult(latest);
  }

  // =========================
  // 参加者の卓制限
  // =========================
  private rebuildMyTables(): void {
    this.myTables.clear();
    const myId = this.entry?.playerId;
    if (!myId) return;

    for (const r of this.swissRounds ?? []) {
      for (const c of r.cells ?? []) {
        if (c.p1?.id === myId || c.p2?.id === myId) this.myTables.add(c.tableName);
      }
    }

    for (const c of this.bracketCells ?? []) {
      if (c.p1?.id === myId || c.p2?.id === myId) this.myTables.add(c.tableName);
    }
  }

  isMyTable(tableName: string): boolean {
    if (this.mode !== 'PLAYER') return true;     // 観戦者は全卓OK
    if (!this.entry?.playerId) return false;     // 参加者なのにID無しは不可
    return this.myTables.has(tableName);
  }

  trackByRound(_: number, r: SwissRoundVM) { return r.round; }
  trackByCell(_: number, c: any) { return c.tableName; }
}
