import { bench, group, run, summary } from "mitata";
import { StableArray } from "./stable-array-implementation";

const ITERATIONS = 1_000_000;

summary(async () => {
  // ADD BENCHMARK
  group("Add", () => {
    bench("Map.set", () => {
      const map = new Map<number, number>();
      for (let i = 0; i < ITERATIONS; i++) {
        map.set(i, i);
      }
    });

    bench("StableArray.add", () => {
      const list = new StableArray<number>(0);
      for (let i = 0; i < ITERATIONS; i++) {
        list.add(i);
      }
    });
  });

  // GET BENCHMARK
  group("Get", () => {
    const map = new Map<number, number>();
    for (let i = 0; i < ITERATIONS; i++) map.set(i, i);

    const list = new StableArray<number>(0);
    for (let i = 0; i < ITERATIONS; i++) list.add(i);

    bench("Map.get", () => {
      let sum = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        sum += map.get(i)!;
      }
      return sum;
    });

    bench("StableArray.get", () => {
      let sum = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        sum += list.get(i);
      }
      return sum;
    });
  });

  // DELETE BENCHMARK
  group("Delete", () => {
    bench("Map.delete", () => {
      const map = new Map<number, number>();
      for (let i = 0; i < ITERATIONS; i++) map.set(i, i);
      for (let i = 0; i < ITERATIONS; i++) {
        map.delete(i);
      }
    });

    bench("StableArray.remove", () => {
      const list = new StableArray<number>(0);
      for (let i = 0; i < ITERATIONS; i++) list.add(i);
      for (let i = 0; i < ITERATIONS; i++) {
        list.remove(i);
      }
    });
  });

  // ITERATE BENCHMARK
  group("Iterate", () => {
    const map = new Map<number, number>();
    for (let i = 0; i < ITERATIONS; i++) map.set(i, i);

    const list = new StableArray<number>(0);
    for (let i = 0; i < ITERATIONS; i++) list.add(i);

    bench("Map.forEach", () => {
      let sum = 0;
      map.forEach((v) => {
        sum += v;
      });
      return sum;
    });

    bench("Map for..of", () => {
      let sum = 0;
      for (const [_, v] of map) {
        sum += v;
      }
      return sum;
    });

    bench("StableArray linear scan", () => {
      let sum = 0;
      // @ts-ignore
      const d = list.data;
      for (let i = 0, l = d.length; i < l; i++) {
        sum += d[i]!;
      }
      return sum;
    });
  });

  // MIXED SCENARIO
  group("Mixed (FIFO-ish)", () => {
    bench("Map (add/get/del-old)", () => {
      const map = new Map<number, number>();
      const ids: number[] = new Array(ITERATIONS);
      let nextAddIndex = 0;
      let nextRemoveIndex = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        // Add
        map.set(i, i);
        ids[nextAddIndex++] = i;

        // Get
        map.get(i);

        // Delete every 3rd step, delete oldest
        if (i % 3 === 0 && nextRemoveIndex < nextAddIndex) {
          const idToRemove = ids[nextRemoveIndex++]!;
          map.delete(idToRemove);
        }
      }
    });

    bench("StableArray (add/get/del-old)", () => {
      const list = new StableArray<number>(0);
      const ids: number[] = new Array(ITERATIONS);
      let nextAddIndex = 0;
      let nextRemoveIndex = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const id = list.add(i);
        ids[nextAddIndex++] = id;

        list.get(id);

        if (i % 3 === 0 && nextRemoveIndex < nextAddIndex) {
          const idToRemove = ids[nextRemoveIndex++]!;
          list.remove(idToRemove);
        }
      }
    });
  });

  await run();
});
