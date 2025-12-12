export interface Piece {
  id: number;
  data: string;
  name: string;
  enabled?: boolean; // モーダル用（false の場合は表示しない）
  kind: string;        // JSONそのまま（otonashi / kotodama）
  countInGame: number; // 0〜8 or 0/1
  imagePath: string;   // 画像ファイルへのパス
}
