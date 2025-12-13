import { ImageFile } from './core/file-storage/image-file';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { DataElement } from './data-element';
import { TabletopObject } from './tabletop-object';

export enum TerrainViewState {
  NULL = 0,
  FLOOR = 1,
  WALL = 2,
  ALL = 3,
}

@SyncObject('terrain')
export class Terrain extends TabletopObject {
  @SyncVar() isLocked: boolean = false;
  @SyncVar() mode: TerrainViewState = TerrainViewState.ALL;
  @SyncVar() rotate: number = 0;

  // === Chess Clock ===
  @SyncVar() clockEnabled: boolean = false;
  @SyncVar() clockInitMs: number = 25 * 60 * 1000;
  @SyncVar() clockP1Ms: number = 25 * 60 * 1000;
  @SyncVar() clockP2Ms: number = 25 * 60 * 1000;
  @SyncVar() clockRunning: boolean = false;
  @SyncVar() clockActive: 'P1' | 'P2' | null = null;
  // 「動いてる間の経過」を計算する基準（操作した人の Date.now() を保存）
  @SyncVar() clockStampMs: number = 0;

  private clockNow(): number { return Date.now(); }


  private clockCommit(now = this.clockNow()) {
    if (!this.clockRunning || !this.clockActive || !this.clockStampMs) {
      this.clockStampMs = now;
      return;
    }
    const dt = Math.max(0, now - this.clockStampMs);
    this.clockStampMs = now;

    if (this.clockActive === 'P1') this.clockP1Ms = Math.max(0, this.clockP1Ms - dt);
    else this.clockP2Ms = Math.max(0, this.clockP2Ms - dt);

    // 0になったら停止
    if (this.clockP1Ms === 0 || this.clockP2Ms === 0) this.clockRunning = false;
  }

  getClockRemaining(player: 'P1' | 'P2'): number {
    if (!this.clockRunning || this.clockActive !== player) return player === 'P1' ? this.clockP1Ms : this.clockP2Ms;
    const now = this.clockNow();
    const dt = Math.max(0, now - (this.clockStampMs || now));
    const base = player === 'P1' ? this.clockP1Ms : this.clockP2Ms;
    return Math.max(0, base - dt);
  }

  clockReset() {
    this.clockEnabled = true;
    this.clockP1Ms = this.clockInitMs;
    this.clockP2Ms = this.clockInitMs;
    this.clockRunning = false;
    this.clockActive = null;
    this.clockStampMs = 0;
  }

  clockStart(active: 'P1' | 'P2' = 'P1') {
    this.clockEnabled = true;
    this.clockActive = this.clockActive ?? active;
    this.clockRunning = true;
    this.clockStampMs = this.clockNow();
  }

  clockPause() {
    this.clockCommit();
    this.clockRunning = false;
  }

  clockSwitch() {
    if (!this.clockEnabled) this.clockReset();
    if (!this.clockRunning) this.clockStart(this.clockActive ?? 'P1');

    this.clockCommit();
    this.clockActive = this.clockActive === 'P1' ? 'P2' : 'P1';
    this.clockStampMs = this.clockNow();
  }


  get width(): number { return this.getCommonValue('width', 1); }
  set width(width: number) { this.setCommonValue('width', width); }
  get height(): number { return this.getCommonValue('height', 1); }
  set height(height: number) { this.setCommonValue('height', height); }
  get depth(): number { return this.getCommonValue('depth', 1); }
  set depth(depth: number) { this.setCommonValue('depth', depth); }
  get name(): string { return this.getCommonValue('name', ''); }
  set name(name: string) { this.setCommonValue('name', name); }

  get wallImage(): ImageFile { return this.getImageFile('wall'); }
  get floorImage(): ImageFile { return this.getImageFile('floor'); }

  get hasWall(): boolean { return this.mode & TerrainViewState.WALL ? true : false; }
  get hasFloor(): boolean { return this.mode & TerrainViewState.FLOOR ? true : false; }

  static create(name: string, width: number, depth: number, height: number, wall: string, floor: string, identifier?: string): Terrain {
    let object: Terrain = null;

    if (identifier) {
      object = new Terrain(identifier);
    } else {
      object = new Terrain();
    }
    object.createDataElements();

    object.commonDataElement.appendChild(DataElement.create('name', name, {}, 'name_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('width', width, {}, 'width_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('height', height, {}, 'height_' + object.identifier));
    object.commonDataElement.appendChild(DataElement.create('depth', depth, {}, 'depth_' + object.identifier));
    object.imageDataElement.appendChild(DataElement.create('wall', wall, { type: 'image' }, 'wall_' + object.identifier));
    object.imageDataElement.appendChild(DataElement.create('floor', floor, { type: 'image' }, 'floor_' + object.identifier));
    object.initialize();

    return object;
  }
}
