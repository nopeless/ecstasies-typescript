import * as PropertyBuilder from "./lib/property-builder";
import { EcstasyError } from "./error";
import { InlineQuery } from "./inline-query";
import { Region } from "./region";
import { createQueryClass } from "./query-class";

/** Compile time symbol */
const T_NAME = Symbol();

// Compile time differentiation built in
export type EcstasyComponents<C> = {
  [K in keyof C]: { [T_NAME]?: K } & ((...args: never) => C[K]);
};

export type EcstasyEntity<C> = { [K in keyof C]?: C[K] | undefined };

/** Entity Command Buffer */
export type ECB = void | (() => unknown);

type EcstasyOptions<C> = {
  components: EcstasyComponents<C>;
  noAutoflush?: boolean;
  selfId?: keyof C;
  one: 1n | 1;
};

export class Ecstasy<C> {
  doAutoflush: boolean;
  selfId: keyof C | undefined;
  _selfIdMap: Map<any, number> = new Map();

  _one: bigint;
  _zero: bigint;

  components: EcstasyComponents<C>;
  _componentBitmask: Record<keyof C, bigint>;
  _componentNextBit: bigint;

  /** ArchetypeId -> RegionIdx */
  _archetypes: Map<bigint, number>;

  /** sparse set + interleaved [RegionIdx, LocalIdx] */
  _regionidx_localidx_array: number[];
  _regionidx_localidx_array_freeidx2: number[];

  _regions: Region<EcstasyEntity<C>>[];

  _references: Map<EcstasyEntity<C>, (string | number | symbol | object)[]>;

  _queries: Map<bigint, Region<EcstasyEntity<C>>[]>;

  Query: ReturnType<typeof createQueryClass<C>>;

  $: PropertyBuilder.T<C>;

  _entityCommandBuffer: ECB[];

  _readerCount: number;

  // These don't exist in runtime
  // @ts-ignore
  C: { [K in keyof C]: C[K] };
  // @ts-ignore
  T: { [K in keyof C]?: C[K] };

  constructor(options: EcstasyOptions<C>) {
    this.doAutoflush = !(options.noAutoflush ?? true);
    this.selfId = options.selfId;
    this._selfIdMap = new Map();

    // @ts-expect-error Type 'number' is not assignable to type 'bigint'
    this._one = options.one;
    this._zero = this._one ^ this._one;

    // Cast is needed to add compile time T_NAME property to the function type
    this.components = options.components as EcstasyComponents<C>;

    // Generate component bitmask inline
    this._componentBitmask = Object.create(null) as Record<keyof C, bigint>;
    this._componentNextBit = this._one;

    for (const key of Object.keys(this.components) as (keyof C)[]) {
      if (key in {}) {
        throw new EcstasyError(
          `Component name "${key.toString()}" is an Object.prototype property and cannot be used`,
        );
      }

      this._componentBitmask[key] = this._componentNextBit;
      this._componentNextBit <<= this._one;

      if (!this._componentNextBit) {
        throw new EcstasyError(
          `Too many components, exceeded bitmask limit of <32 (or options.one was not provided). Set options.one to 1n to accommodate this\n${
            // Component list
            Object.keys(this.components)
              .map((k) => `  - ${k}`)
              .join("\n")
          }`,
        );
      }
    }

    this._archetypes = new Map();

    // perf, hint smi
    this._regionidx_localidx_array = [0];
    this._regionidx_localidx_array.pop();
    this._regionidx_localidx_array_freeidx2 = [0];
    this._regions = [];

    this._references = new Map();

    this._queries = new Map();

    this.Query = createQueryClass(this);

    this.$ = PropertyBuilder.create(options.components);

    this._entityCommandBuffer = [];
    this._readerCount = 0;
  }

  stats() {
    return {
      entityCount: this._regions.reduce((sum, region) => sum + region.entities.length, 0),
      regionCount: this._regions.length,
      archetypeCount: this._archetypes.size,
      queryCount: this._queries.size,
      referenceCount: this._references.size,
    };
  }

  _registerNewRegion(region: Region<EcstasyEntity<C>>) {
    for (const [queryArchetype, queryRegions] of this._queries.entries()) {
      // if queryArchetype is subset of region archetype, add region to query
      if ((region.archetype & queryArchetype) === queryArchetype) {
        queryRegions.push(region);
      }
    }

    this._regions.push(region);
  }

  create(entity: EcstasyEntity<C> = {}): number {
    const keys = Object.keys(entity) as (keyof C)[];

    let archetype = this._zero;

    for (let i = 0; i < keys.length; i++) {
      const mask = this._componentBitmask[keys[i]!];
      if (mask) {
        archetype |= mask;
      }
    }

    const id2 =
      this._regionidx_localidx_array_freeidx2.pop() ?? this._regionidx_localidx_array.length;

    const id = id2 / 2;

    // Check if archetype exists, if not create it
    let regionIdx = this._archetypes.get(archetype);
    let region;
    let localIdx = 0;

    if (regionIdx === undefined) {
      regionIdx = this._regions.length;
      this._archetypes.set(archetype, regionIdx);

      region = new Region(archetype, entity, id);
      this._registerNewRegion(region);
    } else {
      region = this._regions[regionIdx]!;
      localIdx = region.add(entity, id);
    }

    this._regionidx_localidx_array[id2] = regionIdx;
    this._regionidx_localidx_array[id2 + 1] = localIdx;

    if (this.selfId && entity[this.selfId]) this._selfIdMap.set(entity[this.selfId], id);

    return id;
  }

  _startRead() {
    this._readerCount++;
  }

  _endRead() {
    this._readerCount--;

    if (this._readerCount === 0 && this.doAutoflush) {
      this.flush();
    }
  }

  modify(id: number, components: EcstasyEntity<C>) {
    // Get valid id2
    const id2 = id * 2;
    const regionIdx = this._regionidx_localidx_array[id2];
    if (regionIdx === undefined || regionIdx === -1) return null;

    // Trusted
    // Use diff to calculate new archetype
    const region = this._regions[regionIdx]!;
    const localIdx = this._regionidx_localidx_array[id2 + 1]!;

    let archetype = region.archetype;
    const entity = region.get(localIdx);

    const oldSelfId = this.selfId && entity[this.selfId];

    const keys = Object.keys(components) as (keyof C)[];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const property = components[key];

      const mask = this._componentBitmask[key] as bigint;

      if (mask) {
        entity[key] = property;

        if (property === undefined) {
          archetype &= ~mask;
        } else {
          archetype |= mask;
        }
      }
    }

    if (this.selfId) {
      if (oldSelfId !== undefined) {
        // Change ID
        if (entity[this.selfId] === undefined) {
          this._selfIdMap.delete(oldSelfId);
        } else {
          this._selfIdMap.set(components[this.selfId] as string, id);
        }
      } else if (entity[this.selfId] !== undefined) {
        this._selfIdMap.set(entity[this.selfId], id);
      }
    }

    // No change occurred
    if (archetype === region.archetype) return entity;

    if (this._readerCount > 0) {
      throw new EcstasyError(
        "Cannot modify entity archetype as there is an active query." +
          "This can occur if you call modify() inside a query callback." +
          "Deferring the modify call instead (return () => ...)",
      );
    }

    // Remove from old region
    region.remove(localIdx);

    // Check if archetype exists, if not create it
    let newRegionIdx = this._archetypes.get(archetype);
    let newRegion;
    let newLocalIdx = 0;

    if (newRegionIdx === undefined) {
      newRegionIdx = this._regions.length;
      this._archetypes.set(archetype, newRegionIdx);

      newRegion = new Region(archetype, entity, id);
      this._registerNewRegion(newRegion);
    } else {
      newRegion = this._regions[newRegionIdx]!;
      newLocalIdx = newRegion.add(entity, id);
    }

    // Update entity location
    this._regionidx_localidx_array[id2] = newRegionIdx;
    this._regionidx_localidx_array[id2 + 1] = newLocalIdx;

    return entity;
  }

  get(id: number) {
    // Get valid id2
    const id2 = id * 2;
    const regionIdx = this._regionidx_localidx_array[id2];
    if (regionIdx === undefined || regionIdx === -1) return null;

    // Trusted
    const localIdx = this._regionidx_localidx_array[id2 + 1]!;

    return this._regions[regionIdx]!.get(localIdx);
  }

  destroy(id: number) {
    // Get valid id2
    const id2 = id * 2;
    const regionIdx = this._regionidx_localidx_array[id2];
    if (regionIdx === undefined || regionIdx === -1) return null;

    // Trusted
    this._regionidx_localidx_array[id2] = -1;

    this._regionidx_localidx_array_freeidx2.push(id2);

    const entity = this._regions[regionIdx]!.remove(this._regionidx_localidx_array[id2 + 1]!);

    if (this.selfId && entity[this.selfId]) this._selfIdMap.delete(entity[this.selfId]);

    const refs = this._references.get(entity);

    if (refs) {
      for (let i = 0; i < refs?.length; i += 2) {
        // @ts-ignore
        if (refs[i]) refs[i][refs[i + 1]] = null;
      }

      this._references.delete(entity);
    }

    return entity;
  }

  /**
   * Usage
   * ```ts
   * ecs.ref(entity).some.prop = entity2;
   * ```
   */
  ref(entity: EcstasyEntity<C>): typeof entity {
    const handler: ProxyHandler<any> = {
      get: (target, prop) => {
        return new Proxy(target[prop], handler);
      },

      set: (target, prop, value) => {
        const entity2Refs = this._references.getOrInsert(value, []);
        const objRefIdx = entity2Refs.length;
        entity2Refs.push(target);
        entity2Refs.push(prop);

        const entityRefs = this._references.getOrInsert(entity, []);
        entityRefs.push(entity2Refs);
        entityRefs.push(objRefIdx);

        return (target[prop] = value);
      },
    };

    return new Proxy(entity, handler);
  }

  /** Flush entity command buffer */
  flush() {
    for (let i = 0; i < this._entityCommandBuffer.length; i++) {
      this._entityCommandBuffer[i]!();
    }
  }

  /** query by archetype */
  query<A extends PropertyBuilder.T<C>, B extends PropertyBuilder.T<C> = never>(
    spec: A,
    arg2?: "!=" | "<=" | "<" | "*" | B,
  ) {
    let obj = PropertyBuilder.getExternal<InlineQuery<C, keyof C>>(spec);

    if (!obj) {
      obj = new InlineQuery(this, PropertyBuilder.getPath<keyof C>(spec));
      PropertyBuilder.setExternal(spec, obj);
    }

    if (!arg2) {
      return obj;
    }

    if (typeof arg2 === "string") {
      return obj[arg2];
    }

    throw new Error("powerset against another component is not implemented");
  }

  _debug(_opts: { maxRows?: number } = {}) {
    const archetypeToComponentNames = (archetype: bigint) => {
      return Object.entries<bigint>(this._componentBitmask)
        .filter(([_, mask]) => (archetype & mask) !== this._zero)
        .map(([key]) => key);
    };

    const archetypeToBinary = (archetype: bigint) => {
      return archetype
        .toString(2)
        .padStart(Object.keys(this._componentBitmask).length, "0")
        .replace(/0/g, "-")
        .replace(/1/g, "x");
    };

    const opts = {
      maxRows: 10,
      ..._opts,
    };

    console.log("=== Info ===");
    console.log(` Autoflush:`, this.doAutoflush);
    console.log(` One:`, this._one);
    console.log();

    console.log("=== Stats ===");
    const stats = this.stats();
    for (const [key, value] of Object.entries(stats)) {
      console.log(` ${key}:`, value);
    }
    console.log();

    console.log("=== id Map ===");
    for (const [id, entityId] of this._selfIdMap.entries()) {
      console.log(` ${id}: #${entityId}`);
    }
    console.log();

    console.log("=== Component Bitmasks ===");
    for (const [component, bitmask] of Object.entries<bigint>(this._componentBitmask)) {
      console.log(` ${archetypeToBinary(bitmask)}:`, component);
    }
    console.log();

    console.log("=== Archetype Map ===");
    for (const [archetype, regionIdx] of this._archetypes.entries()) {
      console.log(` ${archetypeToBinary(archetype)}:`, regionIdx);
    }
    console.log();

    console.log("=== All Regions ===");
    this._regions.forEach((region, i) => {
      console.log(
        ` ${i}. ${archetypeToBinary(region.archetype)}:`,
        archetypeToComponentNames(region.archetype),
      );
    });
    console.log();

    console.log("=== Queries ===");
    for (const [queryArchetype, queryRegions] of this._queries.entries()) {
      console.log(` ${archetypeToBinary(queryArchetype)}: ${queryRegions.length} regions`);
    }
    console.log();

    console.log("=== Entities by Region ===");
    this._regions.forEach((region, i) => {
      console.log(` ${i}. ${archetypeToBinary(region.archetype)} | size:`, region.entities.length);
      for (let j = 0; j < region.entities.length; j++) {
        const entity = region.entities[j];
        console.log(`   region[${j}] ~${region._id[j]!} ${JSON.stringify(entity)}`);

        if (j >= opts.maxRows - 1) {
          console.log(`   ... and ${region.entities.length - opts.maxRows} more`);
          break;
        }
      }
      console.log();
    });

    console.log("=== Entity Lookup ===");
    for (let i = 0; i < this._regionidx_localidx_array.length; i += 2) {
      const id2 = i;
      const regionIdx = this._regionidx_localidx_array[id2];

      if (regionIdx === undefined || regionIdx === -1) {
        console.log(` entities[${id2}] #${id2 / 2}: <empty>`);
        continue;
      }

      const localIdx = this._regionidx_localidx_array[id2 + 1];

      console.log(` entities[${id2}] #${id2 / 2}: ${regionIdx}. ~${localIdx}`);

      if (id2 >= opts.maxRows * 2 - 2) {
        console.log(`   ... and ${this._regionidx_localidx_array.length / 2 - opts.maxRows} more`);
        break;
      }
    }
    console.log();

    console.log("=== References ===");
    // Build reverse map of entities to print in a more readable way
    const entityToIds = new Map<EcstasyEntity<C>, number>();
    for (let i = 0; i < this._regionidx_localidx_array.length; i += 2) {
      const id2 = i;
      const regionIdx = this._regionidx_localidx_array[id2]!;

      if (regionIdx === -1) {
        continue;
      }

      const localIdx = this._regionidx_localidx_array[id2 + 1]!;
      const region = this._regions[regionIdx]!;
      const entity = region.get(localIdx);

      entityToIds.set(entity, region.getGid(localIdx));
    }

    for (const [entity, refs] of this._references.entries()) {
      const entityId = entityToIds.get(entity);

      const validEntityRefs = refs.filter((v, i) => i % 2 === 0 && !!v);

      console.log(` #${entityId} owns`, validEntityRefs.length, "references");
      for (let i = 0; i < refs.length; i += 2) {
        const ref = refs[i];
        const prop = refs[i + 1];

        if (!ref) console.log(`  refs[${i}]: <invalid ref>`);
        else {
          console.log(`  refs[${i}]:`, JSON.stringify(ref), "@", prop);
        }
      }
    }
    console.log();
  }
}
