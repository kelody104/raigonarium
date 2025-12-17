import { Component, OnInit } from '@angular/core';
import { ModalService } from 'service/modal.service';
import { RaizanMember } from 'service/raizan-auth.service';

export type RaizanProgressResult =
  | { action: 'CLOSE' };

type SeasonValue = { season: number; value: number };

type ProgressResponse = {
  ok: boolean;
  error?: string;
  message?: string;

  playerId?: string;
  member?: RaizanMember & {
    season?: number | string | null;
    rPoint?: number | string | null;
    rate?: number | string | null;
  };

  yaku?: {
    headers: string[];
    counts: any[];
  };

  titles?: {
    headers: string[];
    flags: any[];
  };

  tournamentResults?: Array<{
    tournamentId: string;
    tournamentName: string;
    rank: number | string;
  }>;

  // ★追加（GAS 23_Progress.gs の戻り）
  allSeasonRPoints?: Array<{ season: number | string; value: number | string }>;
  allSeasonRates?: Array<{ season: number | string; value: number | string }>;
};

type YakuBar = {
  key: string;
  name: string;
  count: number;
};

type TitleChip = {
  key: string;
  name: string;
};

function toNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on', 't'].includes(s);
}

@Component({
  selector: 'app-raizan-progress-modal',
  templateUrl: './raizan-progress-modal.component.html',
  styleUrls: ['./raizan-progress-modal.component.css'],
})
export class RaizanProgressModalComponent implements OnInit {
  // opener から直接セットしてもOK / option からも拾う
  playerId = '';

  isBusy = false;
  error = '';

  // json
  titleNames: string[] = [];
  yakuNames: string[] = [];

  // data
  member: (RaizanMember & { season?: any; rPoint?: any; rate?: any }) | null = null;
  yakuBars: YakuBar[] = [];
  titleChips: TitleChip[] = [];
  tournamentResults: Array<{ tournamentName: string; rank: number | string; tournamentId: string }> = [];

  // ★追加：全シーズン
  allSeasonRPoints: SeasonValue[] = [];
  allSeasonRates: SeasonValue[] = [];

  // UI
  showAllYaku = false; // false: 達成済のみ
  yakuMax = 1;

  constructor(
    private modalService: ModalService
  ) { }

  ngOnInit(): void {
    // ★open(..., {playerId}) を option 経由で受け取る
    const opt: any = this.modalService.option;
    if (!String(this.playerId ?? '').trim() && opt?.playerId != null) {
      this.playerId = String(opt.playerId).trim();
    }

    this.bootstrap();
  }

  rankLabel(v: number | string): string {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const n = Number(s);
    if (Number.isFinite(n)) return `${n}位`;
    return s; // 文字列（wins等）はそのまま
  }

  private normalizeSeasonSeries(raw: any): SeasonValue[] {
    const arr = Array.isArray(raw) ? raw : [];
    const out: SeasonValue[] = arr.map((x: any) => ({
      season: toNum(x?.season, NaN),
      value: toNum(x?.value, NaN),
    }))
      .filter(x => Number.isFinite(x.season) && Number.isFinite(x.value))
      .sort((a, b) => a.season - b.season);

    return out;
  }

  private async bootstrap() {
    this.error = '';
    this.isBusy = true;
    try {
      if (!String(this.playerId ?? '').trim()) {
        throw new Error('playerId が指定されていません（プログレスモーダルを開く側で playerId を渡してください）');
      }

      // JSONは並列でロード（失敗しても画面は出す）
      await Promise.allSettled([
        this.loadTitlesJson(),
        this.loadYakuJson(),
      ]);

      await this.loadProgress(this.playerId);
    } catch (e: any) {
      this.error = String(e?.message ?? e);
    } finally {
      this.isBusy = false;
    }
  }

  async loadProgress(playerId: string) {
    this.error = '';
    this.isBusy = true;
    try {
      const pid = String(playerId ?? '').trim();
      if (!pid) throw new Error('playerId is required');

      const url = `https://mitarashi.link/api/sheet-proxy.php?action=progress&playerId=${encodeURIComponent(pid)}`;
      const r = await fetch(url);
      const t = await r.text();

      let j: ProgressResponse;
      try {
        j = JSON.parse(t);
      } catch {
        throw new Error('progress 応答が JSON ではありません（sheet-proxy / GAS を確認）');
      }

      if (!j.ok) throw new Error(j.error || j.message || 'progress failed');

      this.member = j.member ?? null;

      // ★大会成績（大会名＋順位）
      this.tournamentResults = (j.tournamentResults ?? []).map(x => ({
        tournamentId: String(x.tournamentId ?? ''),
        tournamentName: String(x.tournamentName ?? x.tournamentId ?? '').trim(),
        rank: (typeof x.rank === 'number') ? x.rank : (String(x.rank ?? '').trim() || ''),
      }));

      // ★全シーズン
      this.allSeasonRPoints = this.normalizeSeasonSeries(j.allSeasonRPoints);
      this.allSeasonRates = this.normalizeSeasonSeries(j.allSeasonRates);

      // ★タイトル（TRUEだけ）: title1 が TRUE なら title.json[0]
      const flags = (j.titles?.flags ?? []).map(toBool);
      const headers = (j.titles?.headers ?? []).map(h => String(h ?? '').trim());

      const chips: TitleChip[] = [];
      for (let i = 0; i < flags.length; i++) {
        if (!flags[i]) continue;
        const key = headers[i] || `title${i + 1}`;
        const name = this.titleNames[i] || key;
        chips.push({ key, name });
      }
      this.titleChips = chips;

      // ★役（回数）
      const yHeaders = (j.yaku?.headers ?? []).map(h => String(h ?? '').trim());
      const yCounts = (j.yaku?.counts ?? []).map(v => toNum(v, 0));

      const bars: YakuBar[] = [];
      for (let i = 0; i < yCounts.length; i++) {
        const key = yHeaders[i] || `yaku${i + 1}`;
        const name = this.yakuNames[i] || key;
        bars.push({ key, name, count: yCounts[i] });
      }

      // 回数多い順
      bars.sort((a, b) => b.count - a.count);
      this.yakuBars = bars;

      const max = Math.max(0, ...bars.map(b => b.count));
      this.yakuMax = max > 0 ? max : 1;

    } catch (e: any) {
      this.error = String(e?.message ?? e);
    } finally {
      this.isBusy = false;
    }
  }

  get visibleYakuBars(): YakuBar[] {
    if (this.showAllYaku) return this.yakuBars;
    return this.yakuBars.filter(b => b.count > 0);
  }

  barWidthPct(count: number): number {
    const pct = (count / this.yakuMax) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  close() {
    const result: RaizanProgressResult = { action: 'CLOSE' };
    this.modalService.resolve(result);
  }

  // ----- json loaders -----
  private async tryLoadJsonArray(paths: string[], label: string): Promise<string[]> {
    let lastErr: any = null;

    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (!r.ok) {
          lastErr = new Error(`${label} fetch failed: ${p} (${r.status})`);
          continue;
        }
        const j = await r.json();
        if (!Array.isArray(j)) throw new Error(`${label} は配列形式である必要があります`);
        return j.map(x => String(x ?? '').trim());
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) throw lastErr;
    return [];
  }

  private async loadTitlesJson() {
    // 「json/〇〇.json」を第一候補にしつつ、assets もフォールバック
    this.titleNames = await this.tryLoadJsonArray(
      ['json/title.json', 'assets/json/title.json', '/assets/json/title.json', '/json/title.json'],
      'title.json'
    );
  }

  private async loadYakuJson() {
    this.yakuNames = await this.tryLoadJsonArray(
      ['json/yaku.json', 'assets/json/yaku.json', '/assets/json/yaku.json', '/json/yaku.json'],
      'yaku.json'
    );
  }
}
