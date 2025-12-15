import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Entry, Tournament } from '../../models/tournament-models';
import { TournamentSheetService } from '../../service/tournament-sheet.service';

type EnterMode = 'PLAYER' | 'WATCHER';

@Component({
  selector: 'app-tournament-hall-modal',
  templateUrl: './tournament-hall-modal.component.html',
  styleUrls: ['./tournament-hall-modal.component.scss'],
})
export class TournamentHallModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  @Output() entered = new EventEmitter<{
    tournament: Tournament;
    mode: EnterMode;
    entry?: Entry; // PLAYERの場合のみ
  }>();

  tournaments: Tournament[] = [];
  selected?: Tournament;

  mode: EnterMode = 'WATCHER';
  entryId = '';
  error = '';

  loading = false;

  constructor(private sheet: TournamentSheetService) { }

  async onOpen(): Promise<void> {
    if (!this.isOpen) return;
    this.error = '';
    this.loading = true;
    try {
      this.tournaments = await this.sheet.getTournaments();
      this.selected = this.tournaments[0];
    } catch (e) {
      this.error = '大会一覧の取得に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  async enter(): Promise<void> {
    this.error = '';

    if (!this.selected) {
      this.error = '大会を選択してください。';
      return;
    }

    if (this.mode === 'WATCHER') {
      this.entered.emit({ tournament: this.selected, mode: 'WATCHER' });
      return;
    }

    // PLAYER
    const id = this.entryId.trim();
    if (!id) {
      this.error = '参加者IDを入力してください。';
      return;
    }

    this.loading = true;
    try {
      const entry = await this.sheet.getEntryById(this.selected.tournamentId, id);
      if (!entry || entry.role !== 'PLAYER' || !entry.active) {
        this.error = '参加者IDが無効です。';
        return;
      }
      this.entered.emit({ tournament: this.selected, mode: 'PLAYER', entry });
    } catch (e) {
      this.error = '参加者IDの照合に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  onCancel(): void {
    this.close.emit();
  }
}
