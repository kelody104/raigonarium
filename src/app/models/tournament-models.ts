export type Role = 'PLAYER' | 'WATCHER';
export type MatchResult = 'NONE' | 'P1' | 'P2' | 'DRAW' | 'BYE';

export type TournamentStatus = 'OPEN' | 'RUNNING' | 'FINISHED';

export type Tournament = {
  tournamentId: string;
  name: string;
  status: TournamentStatus;
  swissMaxRounds: number;
  topCut: number;
  bracketMaxRounds: number;

  // 既存互換：item1..item20（文字列で保持）
  item1?: string; item2?: string; item3?: string; item4?: string; item5?: string;
  item6?: string; item7?: string; item8?: string; item9?: string; item10?: string;
  item11?: string; item12?: string; item13?: string; item14?: string; item15?: string;
  item16?: string; item17?: string; item18?: string; item19?: string; item20?: string;
};

export type Entry = {
  entryId: string;
  tournamentId: string;
  playerId?: string;
  playerName?: string;
  role: Role;
  active: boolean;
  okugiPieceId?: string;
};

export type SwissMatch = {
  matchId: string;
  tournamentId: string;
  round: number;
  tableName: string;
  p1Id: string;
  p2Id: string;
  p1Wins: number;
  p2Wins: number;
  result: MatchResult;
  logZipUrl?: string;
};

export type BracketMatch = {
  matchId: string;
  tournamentId: string;
  round: number;
  tableName: string;

  // 決勝：ファイナルのみ BO3 を想定（bestOf=3）
  bestOf?: 1 | 3;

  // 互換（BO1想定）
  p1Id?: string;
  p2Id?: string;
  result: MatchResult;
  logZipUrl?: string;

  // BO3（ファイナル）
  p1GameWins?: number; // 0..2
  p2GameWins?: number; // 0..2
  game1Result?: MatchResult;
  game2Result?: MatchResult;
  game3Result?: MatchResult;
  game1LogZipUrl?: string;
  game2LogZipUrl?: string;
  game3LogZipUrl?: string;

  // トーナメント接続（任意）
  nextMatchId?: string;
  nextSlot?: 'P1' | 'P2';

  // 表示補助（任意）
  seed1?: number;
  seed2?: number;
};

// 個人集計（Playersシート）
export type PlayerAggregateRow = {
  playerId: string;
  playerName: string;
  tournamentId: string;
  tournamentName: string;

  // sw1_* ... sw5_*
  [key: string]: string | number | undefined;
};

// ---- 表示用VM ----

export type PlayerView = {
  id: string;
  name: string;
  wins?: number; // スイス表示用
  okugiPieceId?: string;
};

export type MatchActionKind = 'ENTER' | 'RESULT';

export type SwissCellVM = {
  round: number;
  tableName: string;
  p1: PlayerView;
  p2: PlayerView;
  result: MatchResult;
  logZipUrl?: string;

  action: MatchActionKind;
};

export type SwissRoundVM = {
  round: number;
  cells: SwissCellVM[];
};

export type BracketGameVM = {
  gameNo: 1 | 2 | 3;
  result: MatchResult;
  logZipUrl?: string;
};

export type BracketCellVM = {
  round: number;
  tableName: string;

  p1: PlayerView;
  p2: PlayerView;

  bestOf: 1 | 3;
  result: MatchResult; // 確定後に P1/P2

  // BO1
  logZipUrl?: string;

  // BO3（ファイナルのみ使う想定）
  p1GameWins?: number;
  p2GameWins?: number;
  games?: BracketGameVM[];

  action: MatchActionKind;
  // ファイナルは「どの試合の結果を開くか」をUIで選べるように拡張可能
};
