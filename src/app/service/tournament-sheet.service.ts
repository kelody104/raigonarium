import { Injectable } from '@angular/core';
import { BracketMatch, Entry, SwissMatch, Tournament } from '../models/tournament-models';

@Injectable({ providedIn: 'root' })
export class TournamentSheetService {
  // TODO: ここを既存の Sheet API（GAS等）に置き換える

  async getTournaments(): Promise<Tournament[]> {
    return [
      {
        tournamentId: 't001',
        name: 'テスト大会',
        status: 'RUNNING',
        swissMaxRounds: 5,
        topCut: 8,
        bracketMaxRounds: 4,
        item1: 'item1',
      },
    ];
  }

  async getEntries(tournamentId: string): Promise<Entry[]> {
    return [
      { entryId: 'e1', tournamentId, playerId: 'p01', playerName: 'プレイヤー1', role: 'PLAYER', active: true, okugiPieceId: 'okg_01' },
      { entryId: 'e2', tournamentId, playerId: 'p02', playerName: 'プレイヤー2', role: 'PLAYER', active: true, okugiPieceId: 'okg_02' },
      { entryId: 'e3', tournamentId, playerId: 'p03', playerName: 'プレイヤー3', role: 'PLAYER', active: true, okugiPieceId: 'okg_03' },
      { entryId: 'e4', tournamentId, playerId: 'p04', playerName: 'プレイヤー4', role: 'PLAYER', active: true, okugiPieceId: 'okg_04' },
    ];
  }

  async getEntryById(tournamentId: string, entryId: string): Promise<Entry | undefined> {
    const list = await this.getEntries(tournamentId);
    return list.find(e => e.entryId === entryId);
  }

  async getSwissMatches(tournamentId: string): Promise<SwissMatch[]> {
    return [
      { matchId: 'sm1', tournamentId, round: 1, tableName: 'A-1', p1Id: 'p01', p2Id: 'p02', p1Wins: 0, p2Wins: 0, result: 'NONE' },
      { matchId: 'sm2', tournamentId, round: 1, tableName: 'A-2', p1Id: 'p03', p2Id: 'p04', p1Wins: 1, p2Wins: 0, result: 'P1', logZipUrl: 'https://example.com/log.zip' },
    ];
  }

  async getBracketMatches(tournamentId: string): Promise<BracketMatch[]> {
    return [
      { matchId: 'bm1', tournamentId, round: 1, tableName: 'F-1', bestOf: 1, p1Id: 'p01', p2Id: 'p04', result: 'NONE' },
      {
        matchId: 'bmF', tournamentId, round: 4, tableName: 'FINAL', bestOf: 3,
        p1Id: 'p02', p2Id: 'p03',
        p1GameWins: 1, p2GameWins: 0,
        game1Result: 'P1', game1LogZipUrl: 'https://example.com/g1.zip',
        game2Result: 'NONE',
        game3Result: 'NONE',
        result: 'NONE',
      },
    ];
  }
}
