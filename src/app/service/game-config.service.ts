// game-config.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Piece } from 'models/piece';

@Injectable({ providedIn: 'root' })
export class GameConfigService {
  constructor(private http: HttpClient) { }

  loadAllPieces(): Observable<{
    otonashi: Piece[];
    kotodama: Piece[];
    ougi: Piece[];
  }> {
    return forkJoin({
      otonashiRaw: this.http.get<Piece[]>('assets/json/koma/otonashi.json'),
      kotodamaRaw: this.http.get<Piece[]>('assets/json/koma/kotodama.json'),
      ougiRaw: this.http.get<Piece[]>('assets/json/koma/ougi.json'),
    }).pipe(
      map(({ otonashiRaw, kotodamaRaw, ougiRaw }) => {
        const otonashi: Piece[] = otonashiRaw.map(p => ({
          ...p,
          imagePath: `assets/img/koma/otonashi/${p.data}.png`,
        }));

        const kotodama: Piece[] = kotodamaRaw.map(p => ({
          ...p,
          imagePath: `assets/img/koma/kotodama/${p.data}.png`,
        }));

        const ougi: Piece[] = ougiRaw.map(p => ({
          ...p,
          // kind は JSON の値をそのまま使う
          imagePath: `assets/img/koma/ougi/${p.data}.png`,
        }));

        return { otonashi, kotodama, ougi };
      })
    );
  }
}
