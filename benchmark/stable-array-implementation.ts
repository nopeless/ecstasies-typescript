import { assert } from "../src/lib/util";

/**
 * Unsafe StableArray implementation
 */
export class StableArray<T> {
  _idx: number[];
  _id: number[];
  data: T[];

  constructor(shape: T) {
    this._idx = [0];
    this._id = [0];
    this.data = [shape];

    this.remove(0);
  }

  /**
   * Wraps StableArray with runtime checks for existence of IDs
   */
  static createSafe<T>(shape: T): StableArray<T> {
    return new Proxy(new StableArray<T>(shape), {
      get(target, prop) {
        if (prop === "get") {
          return (id: number) => {
            assert(target.exists(id), `ID ${id} does not exist`);
            return target.get(id);
          };
        }
        if (prop === "set") {
          return (id: number, value: T) => {
            assert(target.exists(id), `ID ${id} does not exist`);
            return target.set(id, value);
          };
        }
        if (prop === "exists") {
          return (id: number) => {
            assert(id >= 0, `ID ${id} must be non-negative`);

            return target.exists(id);
          };
        }
        if (prop === "remove") {
          return (id: number) => {
            assert(target.exists(id), `ID ${id} does not exist`);
            return target.remove(id);
          };
        }

        return Reflect.get(target, prop);
      },
    });
  }

  get(id: number): T {
    return this.data[this._idx[id]!]!;
  }

  set(id: number, value: T) {
    return (this.data[this._id[id]!] = value);
  }

  exists(id: number): boolean {
    return id < this._idx.length && this._idx[id]! < this.data.length;
  }

  add(value: T): number {
    const idxl = this._id.length;
    const dl = this.data.length;

    if (idxl === dl) {
      this._idx.push(idxl);
      this._id.push(idxl);
      this.data.push(value);
      return idxl;
    }

    this.data.push(value);
    return this._id[dl]!;
  }

  remove(id: number) {
    const idx = this._idx[id]!;
    const lastIdx = this.data.length - 1;

    if (idx === lastIdx) {
      return this.data.pop()!;
    }

    // Swap _id and _d entries
    const swapLastId = this._id[lastIdx]!;
    const swapId = this._id[idx]!;
    [this._id[idx], this._id[lastIdx]] = [swapLastId, swapId];
    [this.data[idx], this.data[lastIdx]] = [this.data[lastIdx]!, this.data[idx]!];

    // swap _idx entries
    [this._idx[swapId], this._idx[swapLastId]] = [this._idx[swapLastId]!, this._idx[swapId]!];

    return this.data.pop()!;
  }
}
