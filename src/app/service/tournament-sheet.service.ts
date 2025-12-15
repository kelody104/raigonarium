import { Injectable } from '@angular/core';
import { SheetApiService } from './sheet-api.service';
import { BracketMatch, Entry, MatchResult, SwissMatch, Tournament } from '../models/tournament-models';

@Injectable({ providedIn: 'root' })
export class TournamentSheetService {
  constructor(private api: SheetApiService) { }

  async getTournaments(): Promise<Tournament[]> {
    const masters = await this.api.listTournaments();
    // NOTE: いまの tournaments API は swissMaxRounds 等を返してないので、まずは既定値で埋める
    return masters.map((m) => ({
      tournamentId: m.tournamentId,
      name: m.tournamentName,
      swissMaxRounds: 5,
      topCut: 8,
      bracketMaxRounds: 4,
      // item1..20 相当は、必要になったら models 側に持たせる or 別返却に
    })) as Tournament[];
  }

  async getEntries(tournamentId: string): Promise<Entry[]> {
    const rows = await this.api.listEntriesByTournamentId(tournamentId);

    return rows.map((r) => ({
      entryId: r.playerId,          // “参加者ID”として使う想定（必要なら後で変更）
      tournamentId: r.tournamentId,
      playerId: r.playerId,
      playerName: r.playerName,
      role: 'PLAYER',
      active: true,
     ougiPieceId: undefined,      // 今回は空欄でOK
      // items は必要なら保持
      items: r.items,
    })) as any;
  }

  async getEntryById(tournamentId: string, entryId: string): Promise<Entry | undefined> {
    const r = await this.api.getEntryById(tournamentId, entryId);
    if (!r) return undefined;

    return {
      entryId: r.playerId,
      tournamentId: r.tournamentId,
      playerId: r.playerId,
      playerName: r.playerName,
      role: 'PLAYER',
      active: true,
     ougiPieceId: undefined,
      items: r.items,
    } as any;
  }

  async getSwissMatches(tournamentId: string): Promise<SwissMatch[]> {
    const rows = await this.api.listSwissMatches(tournamentId);
    return rows.map((r) => ({
      matchId: r.matchId,
      tournamentId: r.tournamentId,
      round: r.round,
      tableName: r.tableName,
      p1Id: r.p1Id,
      p2Id: r.p2Id,
      p1Wins: r.p1Wins,
      p2Wins: r.p2Wins,
      result: this.toResult(r.result),
      logZipUrl: r.logZipUrl,
    }));
  }

  async getBracketMatches(tournamentId: string): Promise<BracketMatch[]> {
    const rows = await this.api.listBracketMatches(tournamentId);
    return rows.map((r) => ({
      matchId: r.matchId,
      tournamentId: r.tournamentId,
      round: r.round,
      tableName: r.tableName,
      bestOf: (r.bestOf === 3 ? 3 : 1),
      p1Id: r.p1Id,
      p2Id: r.p2Id,
      result: this.toResult(r.result),
      logZipUrl: r.logZipUrl,

      p1GameWins: r.p1GameWins,
      p2GameWins: r.p2GameWins,
      game1Result: r.game1Result ? this.toResult(r.game1Result) : undefined,
      game2Result: r.game2Result ? this.toResult(r.game2Result) : undefined,
      game3Result: r.game3Result ? this.toResult(r.game3Result) : undefined,
      game1LogZipUrl: r.game1LogZipUrl,
      game2LogZipUrl: r.game2LogZipUrl,
      game3LogZipUrl: r.game3LogZipUrl,
    }));
  }

  private toResult(v: string | undefined): MatchResult {
    const s = (v || '').toUpperCase();
    switch (s) {
      case 'P1':
      case 'P2':
      case 'DRAW':
      case 'BYE':
      case 'NONE':
        return s as MatchResult;
      default:
        return 'NONE';
    }
  }
}
