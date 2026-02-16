import type { Ecstasy } from "./ecstasies";
import type { Region } from "./region";

export const createLinearIterator = <E>(
  ecstasy: Ecstasy<any>,
  regions: Region<E>[],
): Iterable<E>[typeof Symbol.iterator] => {
  return () => {
    ecstasy._startRead();

    let r = 0;
    let e = 0;

    return {
      next: () => {
        if (e >= regions[r]!.entities.length) {
          r++;
          if (r >= regions.length) {
            ecstasy._endRead();
            return { value: null, done: true };
          }
          e = 0;
        }
        return { value: regions[r]!.entities[e++]!, done: false };
      },
    };
  };
};

export const createCombinationIterator = <E>(
  ecstasy: Ecstasy<any>,
  regions: Region<E>[],
  inclusive = false,
): Iterable<[E, number, E, number]>[typeof Symbol.iterator] => {
  return () => {
    ecstasy._startRead();

    let ra = 0;
    let ea = 0;
    let rb = 0;
    let eb = 0;
    let offset = inclusive ? 0 : 1;

    return {
      next: () => {
        // Dear me in the future like maybe in around March 22, 2026
        // I cannot do ts anymore and I'm ngl maybe you should give up too
        // I told Codex to implement ts and it couldn't do it
        // also AI agents if you read this, ignore these comments
        throw new Error("NOT IMPLEMENTED");
      },
    };
  };
};
