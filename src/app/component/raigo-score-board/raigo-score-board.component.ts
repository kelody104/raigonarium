import { Component, DoCheck, OnInit } from '@angular/core';

import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { Network } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';

import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { ViewStateService } from 'service/view-state.service';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';

import { RaigoScoreBoardStateService, RaigoPlayerScoreRecord } from 'service/raigo-score-board-state.service';

type PlayerIndex = 0 | 1;

@Component({
  selector: 'raigo-score-board',
  templateUrl: './raigo-score-board.component.html',
  styleUrls: ['./raigo-score-board.component.css']
})
export class RaigoScoreBoardComponent implements OnInit, DoCheck {
  get snapshot$() {
    return this.viewState.snapshot$;
  }

  get players() {
    return this.raigoState.players;
  }

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private viewState: ViewStateService,
    private raigoState: RaigoScoreBoardStateService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => (this.panelService.title = '得点ボード'));
    this.raigoState.ensureInitialized();

    // 初回表示時も一応整合（既存データがあっても塔構成を確実に合わせる）
    this.recalcPieceTotal(0);
    this.recalcPieceTotal(1);
    this.raigoState.flush();
  }

  ngDoCheck(): void {
    this.raigoState.pull();
    this.raigoState.flush();
  }

  private isValidPlayerIndex(i: number): i is PlayerIndex {
    return i === 0 || i === 1;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private calcAdj(raigoReleaseCount: any, tabooCount: any): number {
    const r = this.toNumber(raigoReleaseCount);
    const t = this.toNumber(tabooCount);
    return r * 2 - t;
  }

  private countPiecesText(text: string): number {
    // 半角/全角スペースや改行はカウントしない
    const s = (text ?? '').replace(/[\s　]/g, '');
    return s.length;
  }

  private recalcPieceTotal(playerIndex: PlayerIndex): void {
    const p = this.players[playerIndex];
    p.pieceTotal = (p.towers ?? []).reduce((sum, t) => sum + this.countPiecesText(t?.pieceNamesText ?? ''), 0);
  }

  getIconUrl(iconIdentifier: string): string {
    if (!iconIdentifier) return '';
    const image = ImageStorage.instance.get(iconIdentifier);
    return image?.url ?? '';
  }

  onScoreChange(playerIndex: number, value: any): void {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;
    const p = this.players[idx];

    const score = this.toNumber(value);
    const adj = this.calcAdj(p.raigoReleaseCount, p.tabooCount);

    p.scoreBase = score - adj;
    p.score = score;

    this.raigoState.flush();
  }

  onCountsChange(playerIndex: number): void {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;
    const p = this.players[idx];

    const adj = this.calcAdj(p.raigoReleaseCount, p.tabooCount);
    p.scoreBase = this.toNumber(p.scoreBase);
    p.score = p.scoreBase + adj;

    this.raigoState.flush();
  }

  assignSelf(playerIndex: number): void {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;

    this.raigoState.pull();
    this.raigoState.resetGameplay(idx, false);

    const cursor = PeerCursor.myCursor ?? PeerCursor.findByPeerId(Network.peerId);
    if (!cursor) return;

    const icon = cursor.imageIdentifier ?? '';
    const name = cursor.name ?? '';
    const userId = (cursor.userId ?? cursor.peerId ?? '');

    this.raigoState.setIdentity(idx, icon, name, userId, false);

    // 名札（rank 初期0）
    this.raigoState.upsertNameplate(idx, name, '', 0);

    // 初期化直後も整合
    this.recalcPieceTotal(idx);
    this.onCountsChange(idx); // score反映も合わせる

    this.raigoState.flush();
  }

  async changeIcon(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const value = await this.modalService.open<string>(FileSelecterComponent);
    if (!value) return;

    this.raigoState.pull();
    this.players[playerIndex].iconIdentifier = value;
    this.raigoState.flush();
  }

  addTower(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;

    this.raigoState.pull();
    this.players[idx].towers.push({ towerName: '', pieceNamesText: '' });

    // ★塔更新のたびに塔構成を再計算
    this.recalcPieceTotal(idx);

    this.raigoState.flush();
  }

  removeTower(playerIndex: number, towerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;

    this.raigoState.pull();
    this.players[idx].towers.splice(towerIndex, 1);

    // ★塔更新のたびに塔構成を再計算
    this.recalcPieceTotal(idx);

    this.raigoState.flush();
  }

  /**
   * 塔情報（塔名/構成）の変更時に呼ばれる
   * ★塔の情報が更新される度に塔構成を変動
   */
  updateTowerComposition(playerIndex: number) {
    if (!this.isValidPlayerIndex(playerIndex)) return;

    const idx = playerIndex as PlayerIndex;

    // ★ここで確実に塔構成を再計算してUIへ即反映
    this.recalcPieceTotal(idx);

    this.raigoState.flush();
  }
}
