// raizan-settings-modal.component.ts
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

  // (close)="closeRaizanSettings()" 用
  @Output() close = new EventEmitter<void>();

  // 0〜8
  countOptions: number[] = Array.from({ length: 9 }, (_, i) => i);

  ngOnInit(): void {
    // 元配列を汚さないためにディープコピー
    this.otonashiPieces = this.otonashiPieces.map(p => ({ ...p }));
    this.kotodamaPieces = this.kotodamaPieces.map(p => ({ ...p }));
    this.ougiPieces = this.ougiPieces.map(p => ({ ...p }));
  }

  onChangeCount(piece: Piece, value: number | string): void {
    piece.countInGame = Number(value);
  }

  toggleOugi(piece: Piece): void {
    piece.countInGame = piece.countInGame === 1 ? 0 : 1;
  }

  onClickSave(): void {
    this.save.emit({
      otonashi: this.otonashiPieces,
      kotodama: this.kotodamaPieces,
      ougi: this.ougiPieces,
    });
  }

  onClickClose(): void {
    this.close.emit();
  }
}
