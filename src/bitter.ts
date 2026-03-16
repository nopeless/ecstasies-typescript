import { EcstasyError } from "./error";

const validConstructors = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
] as const;

export type TypedArray = InstanceType<(typeof validConstructors)[number]>;

type WithLeaves<T> = T | { [key: string]: WithLeaves<T> };

type InstantiateLeaves<T> = T extends new (capacity: number) => TypedArray
  ? InstanceType<T>
  : T extends object
    ? { [K in keyof T]: InstantiateLeaves<T[K]> }
    : never;

type BitterOptions<C> = {
  capacity: number;
  components: C;
};

export class Bitter<C extends WithLeaves<new (capacity: number) => TypedArray>> {
  capacity: number;

  freeIds: Int32Array;
  freeIdsLength: number;

  archetype: Int32Array;
  entitiesLength: number;

  components: InstantiateLeaves<C>;
  bit: {
    [K in keyof C]: number;
  };

  _componentPosArrays: TypedArray[][] = [];
  _componentPosArraysLengthPow2: number;

  constructor(options: BitterOptions<C>) {
    this.capacity = options.capacity;

    this.entitiesLength = 0;

    this.freeIds = new Int32Array(this.capacity);
    this.freeIdsLength = 0;

    this.archetype = new Int32Array(this.capacity);

    // Recursively build a fresh object, instantiating leaves
    const instantiate = (obj: any, root: boolean = false): any => {
      if (!~validConstructors.indexOf(obj as any)) {
        if (typeof obj === "object" && obj !== null) {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (root) {
              this._componentPosArrays.push([]);
            }
            result[key] = instantiate(value);
          }
          return result;
        } else {
          throw new EcstasyError("Leaf must be a valid constructor or object");
        }
      }

      const array = new obj(this.capacity);
      this._componentPosArrays.at(-1)!.push(array as TypedArray);
      return array;
    };

    this.components = instantiate(options.components, true) as InstantiateLeaves<C>;
    this._componentPosArraysLengthPow2 = 1 << this._componentPosArrays.length;

    this.bit = Object.fromEntries(
      Object.keys(options.components).map((key, index) => [key, 1 << index]),
    ) as { [K in keyof C]: number };
  }

  /**
   * Zero a specific component (or pass in ~0 to zero all) for an entity ID
   */
  zero(id: number, component: number) {
    const arrays = this._componentPosArrays[component]!;

    let arch = 1;

    for (let i = 1; i < this._componentPosArrays.length; i++) {
      if (component & arch) {
        arrays[i]![id]! = 0;
      }
      arch <<= 1;
    }
  }

  create(): number {
    if (this.freeIdsLength > 0) {
      return this.freeIds[--this.freeIdsLength]!;
    }

    return this.entitiesLength++;
  }

  destroy(id: number) {
    this.archetype[id] = 0;
    this.freeIds[this.freeIdsLength++] = id;
  }
}
