import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { Entry, Tournament } from 'src/app/models/tournament-models';

export type LobbyReturnTarget =
  | { kind: 'RAIZAN_SATO' }
  | { kind: 'TOURNAMENT_HALL' }
  | { kind: 'TOURNAMENT_BOARD'; tournament: Tournament; mode: 'PLAYER' | 'WATCHER'; entry?: Entry };

export interface ViewStateSnapshot {
  kind: 'LOBBY_RETURN';
  target: LobbyReturnTarget;
  savedAt: number; // epoch ms
}

@Injectable({ providedIn: 'root' })
export class ViewStateService {
  private readonly _snapshot$ = new BehaviorSubject<ViewStateSnapshot | null>(null);

  /** Subscribe if you want to reactively show/hide UI (e.g. peer-menu button). */
  readonly snapshot$ = this._snapshot$.asObservable();

  get snapshot(): ViewStateSnapshot | null { return this._snapshot$.value; }
  get hasSnapshot(): boolean { return !!this._snapshot$.value; }

  /** Overwrites the previous snapshot ("last closed modal" policy). */
  saveLobbyReturn(target: LobbyReturnTarget): void {
    this._snapshot$.next({ kind: 'LOBBY_RETURN', target, savedAt: Date.now() });
  }

  clear(): void {
    this._snapshot$.next(null);
  }

  /** Returns the snapshot and clears it. */
  consume(): ViewStateSnapshot | null {
    const v = this._snapshot$.value;
    this._snapshot$.next(null);
    return v;
  }
}
