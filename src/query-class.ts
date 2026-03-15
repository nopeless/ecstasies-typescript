import type { ECB, Ecstasy, EcstasyComponents, EcstasyEntity } from "./ecstasies";
import { EcstasyError } from "./error";
import type { Expand } from "./lib/util";
import { createCombinationIterator, createLinearIterator } from "./query-iterators";
import type { Region } from "./region";

type QueryEntity<C, S> = Expand<
  {
    [K in keyof C]: EcstasyComponents<C>[K] extends S ? C[K] : unknown;
  } & EcstasyEntity<C>
>;

export function createQueryClass<C>(_ecstasy: Ecstasy<C>) {
  return class Query<S extends EcstasyComponents<C>[keyof C]> {
    static ecstasy = _ecstasy;
    static componentInverseMap = new Map(
      Object.entries<EcstasyComponents<C>[keyof C]>(_ecstasy.components).map(([key, value]) => [
        value,
        key as keyof C,
      ]),
    );

    regions: Region<QueryEntity<C, S>>[];

    [Symbol.iterator]: Iterable<QueryEntity<C, S>>[typeof Symbol.iterator];
    combination: Iterable<readonly [QueryEntity<C, S>, number, QueryEntity<C, S>, number]>;

    constructor(componentValues: S[]) {
      let archetype = Query.ecstasy._zero;

      for (const componentValue of componentValues) {
        const componentName = Query.componentInverseMap.get(componentValue);

        if (componentName === undefined) {
          throw new EcstasyError(
            `Component value ${"" + componentValue} is not registered in Ecstasy components`,
          );
        }

        archetype |= Query.ecstasy._componentBitmask[componentName as keyof C];
      }

      this.regions = _ecstasy._queries.getOrInsertComputed(archetype, () =>
        _ecstasy._archetypes
          .entries()
          .filter(([a, _]) => (a & archetype) === archetype)
          .map(([_, regionIdx]) => _ecstasy._regions[regionIdx]!)
          .toArray(),
      ) as Region<QueryEntity<C, S>>[];

      this[Symbol.iterator] = createLinearIterator(Query.ecstasy, this.regions);
      this.combination = {
        [Symbol.iterator]: createCombinationIterator(Query.ecstasy, this.regions),
      };
    }

    toArray() {
      Query.ecstasy._startRead();

      const entities: QueryEntity<C, S>[] = [];

      let idx = 0;

      for (let i = 0; i < this.regions.length; i++) {
        const region = this.regions[i]!;
        for (let j = 0; j < region.entities.length; j++) {
          entities[idx++] = region.entities[j]!;
        }
      }

      Query.ecstasy._endRead();

      return entities;
    }

    forEach(callback: (entity: QueryEntity<C, S>, id: number) => ECB) {
      Query.ecstasy._startRead();

      try {
        for (let i = 0; i < this.regions.length; i++) {
          const region = this.regions[i]!;

          for (let j = 0; j < region.entities.length; j++) {
            const res = callback(region.entities[j]!, region._gid[j]!);

            if (res) Query.ecstasy._entityCommandBuffer.push(res);
          }
        }
      } finally {
        Query.ecstasy._endRead();
      }
    }

    forEachCombination(
      callback: (
        entityA: QueryEntity<C, S>,
        idA: number,
        entityB: QueryEntity<C, S>,
        idB: number,
      ) => ECB,
      inclusive = false,
    ) {
      Query.ecstasy._startRead();

      try {
        for (let ra = 0; ra < this.regions.length; ra++) {
          const regionA = this.regions[ra]!;

          for (let ea = 0; ea < regionA.entities.length; ea++) {
            let offset = inclusive ? 0 : 1;

            for (let rb = ra; rb < this.regions.length; rb++) {
              const regionB = this.regions[rb]!;

              for (let eb = ea + offset; eb < regionB.entities.length; eb++) {
                const res = callback(
                  regionA.entities[ea]!,
                  regionA._gid[ea]!,
                  regionB.entities[eb]!,
                  regionB._gid[eb]!,
                );

                if (res) Query.ecstasy._entityCommandBuffer.push(res);
              }

              offset = 0;
            }
          }
        }
      } finally {
        Query.ecstasy._endRead();
      }
    }
  };
}
