import { EcstasyError } from "./error";

type WithLeaves<T> = T | { [key: string]: WithLeaves<T> };

type InstantiateLeaves<T> = T extends new (capacity: number) => ArrayBufferView
  ? InstanceType<T>
  : T extends object
    ? { [K in keyof T]: InstantiateLeaves<T[K]> }
    : never;

type BitterOptions<C> = {
  capacity: number;
  components: C;
};

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

export class Bitter<C extends WithLeaves<new (capacity: number) => ArrayBufferView>> {
  capacity: number;

  freeIds: Int32Array;
  freeIdsLength: number;

  archetype: Int32Array;
  entitiesLength: number;

  components: InstantiateLeaves<C>;
  bit: {
    [K in keyof C]: number;
  };

  constructor(options: BitterOptions<C>) {
    this.capacity = options.capacity;

    this.entitiesLength = 0;

    this.freeIds = new Int32Array(this.capacity);
    this.freeIdsLength = 0;

    this.archetype = new Int32Array(this.capacity);

    // Recursively build a fresh object, instantiating leaves
    const instantiate = (
      obj: WithLeaves<new (capacity: number) => ArrayBufferView>,
    ): InstantiateLeaves<typeof obj> => {
      if (validConstructors.has(obj as any)) {
        // @ts-ignore
        return new (obj as any)(this.capacity);
      } else if (typeof obj === "object" && obj !== null) {
        return Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [key, instantiate(value)]),
        );
      } else {
        throw new EcstasyError("Leaf must be a valid constructor or object");
      }
    };

    this.components = instantiate(options.components) as InstantiateLeaves<C>;

    this.bit = Object.fromEntries(
      Object.keys(options.components).map((key, index) => [key, 1 << index]),
    ) as { [K in keyof C]: number };
  }

  create(): number {
    if (this.freeIdsLength > 0) {
      return this.freeIds[--this.freeIdsLength]!;
    }

    return this.entitiesLength++;
  }

  destroy(id: number) {
    this.freeIds[this.freeIdsLength++] = id;
  }
}
