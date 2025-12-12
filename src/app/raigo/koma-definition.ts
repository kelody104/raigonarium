// koma-definition.ts （場所は src/app/json でも OK）
export type KomaKind = 'kotodama' | 'otonashi'; // 言霊 / 音無

export interface KomaDefinition {
  /** ID（"1", "2" など内部用） */
  id: number;

  /** data（"RAI", "HEBI" など内部用） */
  data: string;

  /** 駒の表示名。既存の name プロパティに入れる */
  name: string;

  /** 言霊 or 音無 */
  kind: KomaKind;

  /** 重さ（1〜9など） */
  weight: number;

  /** ゲーム中に使用する個数 */
  countInGame: number;

  /** 効果ID（"RAI_HOU","RAI_TEI" など、ロジック側で解釈） */
  effect: string;

  /** 使用可能or不可 */
  enabled: boolean;

  /** 任意入力 */
  specialstr1?: string;
  specialstr2?: string;
  specialnum1?: number;
  specialnum2?: number;
  specialboo1?: number;
  specialboo2?: number;
}
