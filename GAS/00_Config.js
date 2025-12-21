// 00_Config.gs
//test
const ENTRIES_SHEET = '参加者管理';
const TOURNAMENTS_SHEET = '大会管理';

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
// ★参加者管理：entryId, tournamentId, playerId, role, active, item1..item10 = 15列
const ENTRY_COLS = 15;

// ★大会管理：A..O（画像の通り）= 15列
const TOURN_COLS = 17;

const SWISS_COLS = 10;
const BRACKET_COLS = 21;

const API_TOKEN = '';
const BUILD_ID = 'raizan-dev-20251216-01';
