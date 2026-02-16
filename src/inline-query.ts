import type { Ecstasy, EcstasyEntity } from "./ecstasies";
import type { Expand } from "./lib/util";
import { createLinearIterator } from "./query-iterators";
import type { Region } from "./region";

type InlineQueryEntity<C, K> = Expand<
  {
    [P in keyof C]: P extends K ? C[P] : unknown;
  } & EcstasyEntity<C>
>;

/**
 * KeyNames
 */
export class InlineQuery<C, K> {
  ecstasy: Ecstasy<C>;

  [Symbol.iterator]: Iterable<InlineQueryEntity<C, K>>[typeof Symbol.iterator];

  /** self powerset */
  ["*"]: Iterable<InlineQueryEntity<C, K>>;
  /** self powerset excluding when x1 == x2 in (x1, x2) */
  ["!="]: Iterable<InlineQueryEntity<C, K>>;
  /** self combination including when x1 == x2 in (x1, x2) */
  ["<="]: Iterable<InlineQueryEntity<C, K>>;
  /** self combination excluding when x1 == x2 in (x1, x2) */
  ["<"]: Iterable<InlineQueryEntity<C, K>>;

  regions: Region<Expand<{ [P in keyof C]: P extends K ? C[P] : unknown } & EcstasyEntity<C>>>[];

  constructor(ecstasy: Ecstasy<C>, componentNames: K[]) {
    this.ecstasy = ecstasy;

    let archetype = ecstasy._zero;

    for (const componentName of componentNames) {
      archetype |= ecstasy._componentBitmask[componentName as keyof C];
    }

    this.regions = ecstasy._queries.getOrInsertComputed(archetype, () =>
      ecstasy._archetypes
        .entries()
        .filter(([a, _]) => (a & archetype) === archetype)
        .map(([_, regionIdx]) => ecstasy._regions[regionIdx]!)
        .toArray(),
    ) as Region<InlineQueryEntity<C, K>>[];

    this[Symbol.iterator] = createLinearIterator(ecstasy, this.regions);

    // NOT IMPLEMENTED
    this["*"] = null as any;
    this["!="] = null as any;
    this["<="] = null as any;
    this["<"] = null as any;
  }
}
