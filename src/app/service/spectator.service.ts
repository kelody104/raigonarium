import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpectatorService {
  private _enabled = false;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    this._enabled = v;
  }

  toggle(): void {
    this._enabled = !this._enabled;
  }
}
