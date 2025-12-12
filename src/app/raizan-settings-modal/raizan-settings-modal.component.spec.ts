import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RaizanSettingsModalComponent } from './raizan-settings-modal.component';

describe('RaizanSettingsModalComponent', () => {
  let component: RaizanSettingsModalComponent;
  let fixture: ComponentFixture<RaizanSettingsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RaizanSettingsModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RaizanSettingsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
