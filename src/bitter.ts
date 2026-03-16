import { EcstasyError } from "./error";

const validConstructors = new Set([
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
]);

export type TypedArray =
  typeof validConstructors extends Set<infer T extends abstract new (...args: any) => any>
    ? InstanceType<T>
    : never;

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
    const instantiate = (
      obj: WithLeaves<new (capacity: number) => ArrayBufferView>,
      root: boolean = false,
    ): InstantiateLeaves<typeof obj> => {
      if (validConstructors.has(obj as any)) {
        const array = new (obj as any)(this.capacity);
        this._componentPosArrays.at(-1)!.push(array);
        return array as InstantiateLeaves<typeof obj>;
      } else if (typeof obj === "object" && obj !== null) {
        return Object.fromEntries(
          Object.entries(obj).map(([key, value], idx) => {
            if (root) {
              this._componentPosArrays.push([]);
            }
            return [key, instantiate(value)];
          }),
        );
      } else {
        throw new EcstasyError("Leaf must be a valid constructor or object");
      }
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
