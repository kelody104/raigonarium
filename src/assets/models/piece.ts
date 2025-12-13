export interface Piece {
  id: number;
  data: string;
  name: string;
  yomi: string;
  kind: 'otonashi' | 'kotodama' | 'ougi' | string;
  weight: number;
  countInGame: number;

  effect: string;
  text: string;
  enabled: boolean;

  specialstr1: string;
  specialstr2: string;
  specialnum1: number;
  specialnum2: number;
  specialboo1: boolean;
  specialboo2: boolean;

  // 画像ファイルへのパス（GameConfigService 側で付与している想定）
  imagePath: string;
}
