// 00_Config.gs
const ENTRIES_SHEET = 'entries';
const TOURNAMENTS_SHEET = 'tournaments';

const SWISS_SHEET = 'swissMatches';
const BRACKET_SHEET = 'bracketMatches';

const MEMBERS_SHEET = 'プレイヤー管理';
const RATE_SHEET    = 'レート管理';
const RPOINT_SHEET  = 'Rポイント管理';
const SEASONS_SHEET = 'シーズン管理';
const YAKU_SHEET = '役管理';
const TITLES_SHEET = '称号管理';
const TOURNAMENT_RESULTS_SHEET = '大会結果管理';

const TOURNAMENT_LOG_FOLDER_ID = '1x9AMvGY4q1i4k1jUBZ0rtBxgut955QNj';

// 固定列数（現状仕様）
const ENTRY_COLS = 24;   // entryTime, tournamentId, playerId, playerName, item1..20
const TOURN_COLS = 22;   // tournamentId, tournamentName, label1..20
const SWISS_COLS = 10;   // matchId..logZipUrl
const BRACKET_COLS = 21; // matchId..seed2

// 任意：公開書き込みを防ぐならトークン（空なら無効）
const API_TOKEN = '';

const BUILD_ID = 'raizan-dev-20251216-01';
