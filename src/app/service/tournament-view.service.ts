import { Injectable } from '@angular/core';
import {
  BracketCellVM,
  BracketGameVM,
  BracketMatch,
  Entry,
  MatchActionKind,
  MatchResult,
  PlayerView,
  SwissCellVM,
  SwissMatch,
  SwissRoundVM,
} from '../models/tournament-models';

@Injectable({ providedIn: 'root' })
export class TournamentViewService {
  // 奥義駒画像のパス（必要ならプロジェクトに合わせて変更）
  okugiImageUrl(okugiPieceId?: string): string | undefined {
    if (!okugiPieceId) return undefined;
    return `assets/okugi/${okugiPieceId}.png`;
  }

  buildSwissRounds(entries: Entry[], matches: SwissMatch[]): SwissRoundVM[] {
    const playerMap = this.buildPlayerMap(entries);

    // round -> cells
    const byRound = new Map<number, SwissCellVM[]>();

    for (const m of matches) {
      const p1 = this.toPlayerView(playerMap, m.p1Id, m.p1Wins);
      const p2 = this.toPlayerView(playerMap, m.p2Id, m.p2Wins);

      const action: MatchActionKind = m.logZipUrl ? 'RESULT' : 'ENTER';

      const cell: SwissCellVM = {
        round: m.round,
        tableName: m.tableName,
        p1,
        p2,
        result: m.result,
        logZipUrl: m.logZipUrl,
        action,
      };

      const list = byRound.get(m.round) ?? [];
      list.push(cell);
      byRound.set(m.round, list);
    }

    // 卓順の安定化（tableNameでソート）
    const rounds: SwissRoundVM[] = [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, cells]) => ({
        round,
        cells: cells.sort((x, y) => (x.tableName ?? '').localeCompare(y.tableName ?? '')),
      }));

    return rounds;
  }

  buildBracketCells(entries: Entry[], matches: BracketMatch[]): BracketCellVM[] {
    const playerMap = this.buildPlayerMap(entries);

    const cells: BracketCellVM[] = matches
      .slice()
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return (a.tableName ?? '').localeCompare(b.tableName ?? '');
      })
      .map((m) => this.toBracketCellVM(playerMap, m));

    return cells;
  }

  // ---- private ----

  private buildPlayerMap(entries: Entry[]): Map<string, { name: string; okugiPieceId?: string }> {
    const map = new Map<string, { name: string; okugiPieceId?: string }>();

    for (const e of entries) {
      if (!e.active) continue;
      if (e.role !== 'PLAYER') continue;
      if (!e.playerId) continue;

      map.set(e.playerId, {
        name: e.playerName ?? e.playerId,
        okugiPieceId: e.okugiPieceId,
      });
    }
    return map;
  }

  private toPlayerView(
    playerMap: Map<string, { name: string; okugiPieceId?: string }>,
    playerId: string | undefined,
    wins?: number
  ): PlayerView {
    const id = playerId ?? '';
    const info = id ? playerMap.get(id) : undefined;

    return {
      id,
      name: info?.name ?? (id || '—'),
      wins,
      okugiPieceId: info?.okugiPieceId,
    };
  }

  private toBracketCellVM(
    playerMap: Map<string, { name: string; okugiPieceId?: string }>,
    m: BracketMatch
  ): BracketCellVM {
    const bestOf: 1 | 3 = (m.bestOf === 3 ? 3 : 1);

    const p1 = this.toPlayerView(playerMap, m.p1Id, undefined);
    const p2 = this.toPlayerView(playerMap, m.p2Id, undefined);

    // BO3の場合：gameログが1本でもあればRESULT
    const hasAnyGameLog = !!(m.game1LogZipUrl || m.game2LogZipUrl || m.game3LogZipUrl);
    const action: MatchActionKind =
      bestOf === 3 ? (hasAnyGameLog ? 'RESULT' : 'ENTER') : (m.logZipUrl ? 'RESULT' : 'ENTER');

    let games: BracketGameVM[] | undefined;
    if (bestOf === 3) {
      games = [
        { gameNo: 1, result: (m.game1Result ?? 'NONE') as MatchResult, logZipUrl: m.game1LogZipUrl },
        { gameNo: 2, result: (m.game2Result ?? 'NONE') as MatchResult, logZipUrl: m.game2LogZipUrl },
        { gameNo: 3, result: (m.game3Result ?? 'NONE') as MatchResult, logZipUrl: m.game3LogZipUrl },
      ];
    }

    return {
      round: m.round,
      tableName: m.tableName,
      p1,
      p2,
      bestOf,
      result: m.result,
      logZipUrl: m.logZipUrl,
      p1GameWins: m.p1GameWins,
      p2GameWins: m.p2GameWins,
      games,
      action,
    };
  }
}
