// src/app/component/raizan-settings-modal/raizan-settings-modal.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Piece } from 'models/piece';

@Component({
  selector: 'app-raizan-settings-modal',
  templateUrl: './raizan-settings-modal.component.html',
  styleUrls: ['./raizan-settings-modal.component.scss'],
})
export class RaizanSettingsModalComponent implements OnInit {

  @Input() otonashiPieces: Piece[] = [];
  @Input() kotodamaPieces: Piece[] = [];
  @Input() ougiPieces: Piece[] = []; // 奥義

  @Output() save = new EventEmitter<{
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
  }>();

  @Output() close = new EventEmitter<void>();

  // 0〜8
  countOptions: number[] = Array.from({ length: 9 }, (_, i) => i);

  // 奥義検索（ひらがな）
  ougiSearchTerm = '';

  ngOnInit(): void {
    // 親の配列を汚さないようにコピーしつつ enabled=false を除外
    this.otonashiPieces = this.filterEnabled(
      this.otonashiPieces.map(p => ({ ...p }))
    );
    this.kotodamaPieces = this.filterEnabled(
      this.kotodamaPieces.map(p => ({ ...p }))
    );
    this.ougiPieces = this.filterEnabled(
      this.ougiPieces.map(p => ({ ...p }))
    );
  }

  /** enabled が false の駒を除外 */
  private filterEnabled(pieces: Piece[]): Piece[] {
    return pieces.filter((p: any) => p.enabled !== false);
  }

  onChangeCount(piece: Piece, value: number | string): void {
    piece.countInGame = Number(value);
  }

  /** 奥義: 0 ↔ 1 で切り替え */
  toggleOugi(piece: Piece): void {
    piece.countInGame = piece.countInGame === 1 ? 0 : 1;
  }

  onClickSave(): void {
    this.save.emit({
      otonashi: this.otonashiPieces,
      kotodama: this.kotodamaPieces,
      ougi: this.ougiPieces,
    });
    this.close.emit();
  }

  onClickClose(): void {
    this.close.emit();
  }

  // 背景クリックで閉じる
  onClickBackdrop(): void {
    this.close.emit();
  }

  /** 奥義の検索結果（yomi にひらがなが含まれるものだけ） */
  get filteredOugiPieces(): Piece[] {
    const term = this.ougiSearchTerm.trim();
    if (!term) {
      return this.ougiPieces;
    }

    const normalized = term.toLowerCase();

    return this.ougiPieces.filter((p: any) => {
      const yomi: string = (p.yomi ?? '') as string;
      return yomi.toLowerCase().includes(normalized);
    });
  }
}
