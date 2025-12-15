import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  BracketCellVM,
  Entry,
  SwissRoundVM,
  Tournament,
} from '../../models/tournament-models';
import { TournamentSheetService } from '../../service/tournament-sheet.service';
import { TournamentViewService } from '../../service/tournament-view.service';

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

  constructor(
    private sheet: TournamentSheetService,
    public view: TournamentViewService
  ) { }

  async onOpen(): Promise<void> {
    if (!this.isOpen || !this.tournament) return;

    this.loading = true;
    this.error = '';
    try {
      const [entries, swissMatches, bracketMatches] = await Promise.all([
        this.sheet.getEntries(this.tournament.tournamentId),
        this.sheet.getSwissMatches(this.tournament.tournamentId),
        this.sheet.getBracketMatches(this.tournament.tournamentId),
      ]);

      this.swissRounds = this.view.buildSwissRounds(entries, swissMatches);
      this.bracketCells = this.view.buildBracketCells(entries, bracketMatches);
    } catch (e) {
      this.error = '対戦表の取得に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  onCancel(): void {
    this.close.emit();
  }

  // 入室（卓ルーム接続）は、既存の導線に後で接続する（今はイベントだけ）
  enterTable(tableName: string): void {
    console.log('[ENTER]', tableName);
    // TODO: 既存のルーム入室処理へ接続
  }

  // 結果（ZIP読込）は後で MatchLogZipService に接続（今はURLログ）
  openResult(zipUrl?: string): void {
    console.log('[RESULT]', zipUrl);
    // TODO: ZIP読込処理へ接続
  }

  // ファイナルBO3用：最新のログを開く（簡易）
  openLatestGameResult(cell: BracketCellVM): void {
    const urls = (cell.games ?? [])
      .map(g => g.logZipUrl)
      .filter((u): u is string => !!u);
    const latest = urls[urls.length - 1];
    this.openResult(latest);
  }

  trackByRound(_: number, r: SwissRoundVM) { return r.round; }
  trackByTable(_: number, c: any) { return c.tableName; }
}
