import { Component, OnInit } from '@angular/core';
import { ModalService } from 'service/modal.service';
import { RaizanAuthService, RaizanMember } from 'service/raizan-auth.service';

export type RaizanSatoResult =
  | { action: 'CLOSE' }
  | { action: 'OPEN_TOURNAMENT_HALL'; member?: RaizanMember };

@Component({
  selector: 'app-raizan-sato-modal',
  templateUrl: './raizan-sato-modal.component.html',
  styleUrls: ['./raizan-sato-modal.component.css'],
})
export class RaizanSatoModalComponent implements OnInit {
  playerId = '';
  password = '';
  remember = true;

  isBusy = false;
  error = '';

  member: RaizanMember | null = null;

  constructor(
    private modalService: ModalService,
    private auth: RaizanAuthService
  ) { }

  ngOnInit(): void {
    this.tryAutoLogin();
  }

  private async tryAutoLogin() {
    const saved = this.auth.loadSavedCredentials();
    if (!saved) return;

    this.playerId = saved.playerId;
    this.password = saved.password;

    await this.login(true);
  }

  async login(isAuto = false) {
    this.error = '';
    this.isBusy = true;
    try {
      const m = await this.auth.login(this.playerId, this.password);
      this.member = m;

      if (this.remember) {
        this.auth.saveCredentials(this.playerId, this.password);
      } else {
        this.auth.clearSavedCredentials();
      }
    } catch (e: any) {
      this.member = null;
      if (isAuto) this.auth.clearSavedCredentials();
      this.error = String(e?.message ?? e);
    } finally {
      this.isBusy = false;
    }
  }

  logout() {
    this.member = null;
    this.password = '';
    this.auth.clearSavedCredentials();
  }

  goTournamentHall() {
    const result: RaizanSatoResult = { action: 'OPEN_TOURNAMENT_HALL', member: this.member ?? undefined };
    this.modalService.resolve(result);
  }

  goTournamentHallWithoutLogin() {
    const result: RaizanSatoResult = { action: 'OPEN_TOURNAMENT_HALL' };
    this.modalService.resolve(result);
  }

  close() {
    const result: RaizanSatoResult = { action: 'CLOSE' };
    this.modalService.resolve(result);
  }
}
