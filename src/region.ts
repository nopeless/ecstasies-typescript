/**
 * StableArray based entity store
 */
export class Region<T> {
  archetype: bigint;

  _idx: number[];
  _id: number[];
  _gid: number[];
  entities: T[];

  constructor(archetype: bigint, seedEntity: T, gid: number) {
    this.archetype = archetype;
    this._idx = [0];
    this._id = [0];
    this._gid = [gid];
    this.entities = [seedEntity];
  }

  get(id: number): T {
    return this.entities[this._idx[id]!]!;
  }

  getGid(id: number): number {
    return this._gid[this._id[id]!]!;
  }

  set(id: number, value: T, gid: number) {
    this._gid[this._id[id]!] = gid;
    return (this.entities[this._id[id]!] = value);
  }

  exists(id: number): boolean {
    return id < this._idx.length && this._idx[id]! < this.entities.length;
  }

  add(value: T, gid: number): number {
    const idxl = this._id.length;
    const dl = this.entities.length;

    this._gid.push(gid);
    this.entities.push(value);

    if (idxl === dl) {
      this._idx.push(idxl);
      this._id.push(idxl);
      return idxl;
    }

    return this._id[dl]!;
  }

  remove(id: number) {
    const idx = this._idx[id]!;
    const lastIdx = this.entities.length - 1;

    this._gid.pop();

    if (idx === lastIdx) {
      return this.entities.pop()!;
    }

    // Swap _id and _d entries
    const swapLastId = this._id[lastIdx]!;
    const swapId = this._id[idx]!;
    [this._id[idx], this._id[lastIdx]] = [swapLastId, swapId];
    [this.entities[idx], this.entities[lastIdx]] = [this.entities[lastIdx]!, this.entities[idx]!];

    // swap _idx entries
    [this._idx[swapId], this._idx[swapLastId]] = [this._idx[swapLastId]!, this._idx[swapId]!];

    return this.entities.pop()!;
  }
}
