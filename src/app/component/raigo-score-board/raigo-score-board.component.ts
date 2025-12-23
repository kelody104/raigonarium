import { Component, DoCheck, OnInit } from '@angular/core';

import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { Network } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';

import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { ViewStateService } from 'service/view-state.service';

import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';

interface TowerRecord {
  towerName: string;
  pieceNamesText: string; // 区切りなし。文字数＝駒数（空白/改行は除外）
}

interface PlayerScoreRecord {
  iconIdentifier: string;
  name: string;   // 手動入力不可（表示のみ）
  userId: string; // 手動入力不可（表示のみ）

  score: number;

  towers: TowerRecord[];

  // 「塔構成」：完成した塔の構成文字列の合計駒数（＝この欄の駒数合計）
  pieceTotal: number;

  // 現状は手動入力のまま（将来自動算出も可）
  innerPieceTotal: number;

  raigoReleaseCount: number;
  tabooCount: number;

  // --- 内部管理（UIに出さない） ---
  /** 前回反映した雷轟解放回数（差分加算用） */
  __lastRaigoReleaseCount?: number;
  /** 前回反映した禁忌回数（差分加算用） */
  __lastTabooCount?: number;
}

@Component({
  selector: 'raigo-score-board',
  templateUrl: './raigo-score-board.component.html',
  styleUrls: ['./raigo-score-board.component.css']
})
export class RaigoScoreBoardComponent implements OnInit, DoCheck {

  get snapshot$() { return this.viewState.snapshot$; }

  players: [PlayerScoreRecord, PlayerScoreRecord] = [
    this.createEmptyPlayer(),
    this.createEmptyPlayer()
  ];

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private viewState: ViewStateService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.panelService.title = '得点ボード');
    this.updateTowerComposition(0);
    this.updateTowerComposition(1);
  }

  ngDoCheck(): void {
    this.applyScoreAutoAdjust(0);
    this.applyScoreAutoAdjust(1);
  }

  private createEmptyPlayer(): PlayerScoreRecord {
    return {
      iconIdentifier: '',
      name: '',
      userId: '',
      // 既定得点
      score: 2,
      towers: [],
      pieceTotal: 0,
      innerPieceTotal: 0,
      raigoReleaseCount: 0,
      tabooCount: 0,
      __lastRaigoReleaseCount: 0,
      __lastTabooCount: 0
    };
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * 雷轟解放回数×2、禁忌×(-1) を「得点」に差分で自動加算する。
   * - 得点欄はユーザーが直接編集できる前提のまま維持
   * - 雷轟解放/禁忌の変更分だけを加減算するので、何度も再計算で上書きしない
   */
  private applyScoreAutoAdjust(playerIndex: number): void {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const p = this.players[playerIndex];

    const nowRelease = this.toNumber(p.raigoReleaseCount);
    const nowTaboo = this.toNumber(p.tabooCount);

    const lastRelease = this.toNumber(p.__lastRaigoReleaseCount);
    const lastTaboo = this.toNumber(p.__lastTabooCount);

    if (nowRelease === lastRelease && nowTaboo === lastTaboo) return;

    const deltaRelease = (nowRelease - lastRelease) * 2;
    const deltaTaboo = (nowTaboo - lastTaboo) * (-1);
    const delta = deltaRelease + deltaTaboo;

    if (delta !== 0) {
      p.score = this.toNumber(p.score) + delta;
    }

    p.__lastRaigoReleaseCount = nowRelease;
    p.__lastTabooCount = nowTaboo;
  }

  private isValidPlayerIndex(i: number): i is 0 | 1 {
    return i === 0 || i === 1;
  }

  getIconUrl(iconIdentifier: string): string {
    if (!iconIdentifier) return '';
    const image = ImageStorage.instance.get(iconIdentifier);
    return image?.url ?? '';
  }

  /**
   * P1/P2押下時にリセットする対象のみ初期値へ戻す
   * （アイコン/名前/IDは押下後に自分の情報を代入するため、ここでは触らない）
   */
  private resetPlayerGameplayFields(p: PlayerScoreRecord): void {
    // 指定の項目を初期化
    p.raigoReleaseCount = 0;
    p.tabooCount = 0;
    p.innerPieceTotal = 0;

    // 完成した塔
    p.towers = [];

    // 塔構成
    p.pieceTotal = 0;

    // 得点（デフォルト2）
    p.score = 2;

    // 差分加算の内部状態も初期化（これをしないと次回入力でズレる）
    p.__lastRaigoReleaseCount = 0;
    p.__lastTabooCount = 0;
  }

  /**
   * P1/P2クリックで
   * 1) 指定項目を初期値へ戻す
   * 2) 「自分の」アイコン・名前・IDを代入
   */
  assignSelf(playerIndex: number): void {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const p = this.players[playerIndex];

    // まずリセット
    this.resetPlayerGameplayFields(p);

    // 自分の情報を代入
    const cursor = PeerCursor.myCursor ?? PeerCursor.findByPeerId(Network.peerId);
    if (!cursor) return;

    p.iconIdentifier = cursor.imageIdentifier ?? '';
    p.name = cursor.name ?? '';
    p.userId = (cursor.userId ?? cursor.peerId ?? '');
  }

  async changeIcon(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const value = await this.modalService.open<string>(FileSelecterComponent);
    if (!value) return;

    this.players[playerIndex].iconIdentifier = value;
  }

  addTower(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;
    this.players[playerIndex].towers.push({ towerName: '', pieceNamesText: '' });
    this.updateTowerComposition(playerIndex);
  }

  removeTower(playerIndex: number, towerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;
    this.players[playerIndex].towers.splice(towerIndex, 1);
    this.updateTowerComposition(playerIndex);
  }

  /**
   * 構成は「区切り無し」：文字数が駒数
   * ただし空白・改行・タブ等は除外して数える。
   */
  countPieces(pieceNamesText: string): number {
    const s = (pieceNamesText ?? '').replace(/\s/g, '');
    return s.length;
  }

  towersPieceCount(playerIndex: number): number {
    if (!this.isValidPlayerIndex(playerIndex)) return 0;
    return this.players[playerIndex].towers.reduce((sum, t) => sum + this.countPieces(t.pieceNamesText), 0);
  }

  /** 「この欄の駒数合計」→「塔構成(pieceTotal)」へ反映 */
  updateTowerComposition(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;
    this.players[playerIndex].pieceTotal = this.towersPieceCount(playerIndex);
  }
}
