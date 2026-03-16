import { describe, expect, test } from "bun:test";
import { Ecstasy } from "../src";
import { assert } from "../src/lib/util";

// typechecks
// oxlint-disable-next-line no-unused-expressions
() => {
  // declare function assertType

  let _: any;

  const ecs = new Ecstasy({
    components: {
      pos: () => ({ x: 0, y: 0 }),
      vel: () => ({ x: 0, y: 0 }),
    },
    one: 1,
  });

  // two components of same return type must be distinct
  assert<typeof ecs.components.pos extends typeof ecs.components.vel ? false : true>();
  assert<typeof ecs.components.pos extends typeof ecs.components.vel ? false : true>();
};

describe("Ecstasy", () => {
  describe("constructor", () => {
    test("Component count", () => {
      new Ecstasy({
        components: Object.fromEntries(
          Array.from({ length: 31 }).map((_, i) => [`component${i}`, () => ({})]),
        ),
        one: 1,
      });

      expect(
        () =>
          new Ecstasy({
            components: Object.fromEntries(
              Array.from({ length: 32 }).map((_, i) => [`component${i}`, () => ({})]),
            ),
            one: 1,
          }),
      ).toThrowError();

      new Ecstasy({
        components: Object.fromEntries(
          Array.from({ length: 32 }).map((_, i) => [`component${i}`, () => ({})]),
        ),
        one: 1n,
      });
    });

    test("prohibiting object prototype properties", () => {
      expect(
        () =>
          new Ecstasy({
            components: {
              toString: () => ({}),
            },
            one: 1,
          }),
      ).toThrowError();
    });
  });

  describe("methods", () => {
    test("create/get/destroy", () => {
      const ecs = new Ecstasy({
        components: {
          pos: () => ({ x: 0, y: 0 }),
          vel: () => ({ x: 0, y: 0 }),
        },
        one: 1,
      });

      const id1 = ecs.create({ pos: { x: 1, y: 2 } });
      const id2 = ecs.create({ vel: { x: 3, y: 4 } });

      // oxlint-disable-next-line no-unused-expressions
      () => {
        // @ts-expect-error Object literal may only specify known properties
        ecs.create({ foo: "bar" });

        const noCommon = { foo: "bar" };
        // @ts-expect-error has no properties in common with type
        ecs.create(noCommon);
      };

      // Compile time
      const pos3: typeof ecs.C.pos = { x: 5, y: 6 };
      const entity3: typeof ecs.T = { pos: pos3, vel: { x: 7, y: 8 } };

      const id3 = ecs.create(entity3);

      const id4 = ecs.create();
      const id5 = ecs.create({ pos: { x: 9, y: 10 }, vel: { x: 11, y: 12 } });

      // ecs._debug();

      expect(ecs.get(-1)).toEqual(null);
      expect(ecs.get(5)).toEqual(null);
      expect(ecs.get(999)).toEqual(null);
      expect(ecs.get(Infinity)).toEqual(null);
      expect(ecs.get(NaN)).toEqual(null);

      // Fixtures
      expect(ecs.get(id1)).toEqual({ pos: { x: 1, y: 2 } });
      expect(ecs.get(id2)).toEqual({ vel: { x: 3, y: 4 } });
      expect(ecs.get(id3)).toEqual({ pos: { x: 5, y: 6 }, vel: { x: 7, y: 8 } });
      expect(ecs.get(id4)).toEqual({});
      expect(ecs.get(id5)).toEqual({ pos: { x: 9, y: 10 }, vel: { x: 11, y: 12 } });

      expect([id1, id2, id3, id4, id5]).toEqual([0, 1, 2, 3, 4]);

      // clean up
      expect(ecs.destroy(id1)).toEqual({ pos: { x: 1, y: 2 } });
      expect(ecs.destroy(id2)).toEqual({ vel: { x: 3, y: 4 } });
      expect(ecs.destroy(id3)).toEqual({ pos: { x: 5, y: 6 }, vel: { x: 7, y: 8 } });
      expect(ecs.destroy(id4)).toEqual({});
      expect(ecs.destroy(id5)).toEqual({ pos: { x: 9, y: 10 }, vel: { x: 11, y: 12 } });

      // ecs._debug();

      // must be empty
      expect(ecs._regions.reduce((acc, r) => acc + r.entities.length, 0)).toEqual(0);
    });

    test("modify", () => {
      const ecs = new Ecstasy({
        components: {
          pos: () => ({ x: 0, y: 0 }),
          vel: () => ({ x: 0, y: 0 }),
        },
        one: 1,
      });

      const id1 = ecs.create({ pos: { x: 1, y: 2 } });
      const id2 = ecs.create({ vel: { x: 3, y: 4 } });

      expect(ecs.modify(-1, { pos: { x: 5, y: 6 } })).toEqual(null);
      expect(ecs.modify(999, { pos: { x: 5, y: 6 } })).toEqual(null);

      expect(ecs.modify(id1, { vel: { x: 5, y: 6 } })).toEqual({
        pos: { x: 1, y: 2 },
        vel: { x: 5, y: 6 },
      });
      expect(ecs.modify(id2, { pos: { x: 7, y: 8 } })).toEqual({
        pos: { x: 7, y: 8 },
        vel: { x: 3, y: 4 },
      });

      expect(ecs.modify(id1, { pos: undefined, vel: undefined })).toEqual({});
      expect(ecs.modify(id2, { pos: undefined, vel: undefined })).toEqual({});

      // ecs._debug();
    });
  });

  function createFixtureEcstasy() {
    const ecs = new Ecstasy({
      components: {
        pos: () => ({ x: 0, y: 0 }),
        vel: () => ({ x: 0, y: 0 }),
        mass: () => 0,
      },
      one: 1,
    });

    const entities: (typeof ecs.T)[] = [
      // throw in a variety of entities 2-4 of each archetype, mix order later too
      { pos: { x: 1, y: 2 } },
      { pos: { x: 3, y: 4 } },
      { vel: { x: 5, y: 6 } },
      { vel: { x: 7, y: 8 } },
      { pos: { x: 9, y: 10 }, vel: { x: 11, y: 12 } },
      { pos: { x: 13, y: 14 }, vel: { x: 15, y: 16 } },
      { mass: 17 },
      { mass: 18 },
      { pos: { x: 19, y: 20 }, mass: 21 },
      { pos: { x: 22, y: 23 }, mass: 24 },
      { vel: { x: 25, y: 26 }, mass: 27 },
      { vel: { x: 28, y: 29 }, mass: 30 },
      { pos: { x: 31, y: 32 }, vel: { x: 33, y: 34 }, mass: 35 },
      { pos: { x: 36, y: 37 } },
      { vel: { x: 38, y: 39 } },
      { pos: { x: 40, y: 41 }, vel: { x: 42, y: 43 } },
      { pos: { x: 44, y: 45 }, mass: 46 },
    ];

    for (const entity of entities) {
      ecs.create(entity);
    }

    return ecs;
  }

  describe("new Query", () => {
    test("constructor", () => {
      const ecs = createFixtureEcstasy();

      expect(
        () =>
          new ecs.Query([
            // this is a run time error
            () => ({ x: 0, y: 0 }),
          ]),
      ).toThrowError();

      new ecs.Query([ecs.components.pos]);
    });

    test("null query", () => {
      const ecs = createFixtureEcstasy();

      const query = new ecs.Query([]);

      expect(query.toArray().length).toEqual(ecs.stats().entityCount);
    });

    test("basic query", () => {
      const ecs = createFixtureEcstasy();

      const nullQuery = new ecs.Query([]);

      const query = new ecs.Query([ecs.components.pos]);

      expect(query.toArray().length).toEqual(
        // manual
        nullQuery.toArray().filter((e) => e.pos).length,
      );
    });

    test("combined query", () => {
      const ecs = createFixtureEcstasy();

      const nullQuery = new ecs.Query([]);

      const query = new ecs.Query([ecs.components.pos, ecs.components.vel]);

      expect(query.toArray().length).toEqual(
        // manual
        nullQuery.toArray().filter((e) => e.pos && e.vel).length,
      );
    });
  });

  describe("query()", () => {
    test("basic", () => {
      const ecs = createFixtureEcstasy();

      const query = ecs.query(ecs.$.pos);
    });

    test("compound", () => {
      const ecs = createFixtureEcstasy();

      const query = ecs.query(ecs.$.pos.vel);
    });

    test.skip("combinatorics", () => {
      const ecs = createFixtureEcstasy();

      // All supported operators
      const query1 = ecs.query(ecs.$.pos, "!=");
      const query2 = ecs.query(ecs.$.pos, "<=");
      const query3 = ecs.query(ecs.$.pos, "<");

      // With self (powerset)
      const query4 = ecs.query(ecs.$.pos, "*");

      // With another component
      const query5 = ecs.query(ecs.$.pos, ecs.$.vel);
    });
  });

  describe("References", () => {
    test("ref", () => {
      const ecs = new Ecstasy({
        components: {
          comp: () =>
            ({
              target: {},
              inner: {
                target: {},
              },
            }) as Partial<{ target: any; inner: { target: any } }>,
        },
        one: 1,
      });

      const entity1: typeof ecs.T = { comp: {} };
      const id1 = ecs.create(entity1);
      const entity2: typeof ecs.T = { comp: {} };
      const id2 = ecs.create(entity2);

      ecs.ref(entity1).comp!.target = entity2;

      // ecs._debug();

      ecs.destroy(id2);

      // ecs._debug();

      ecs.destroy(id1);

      // ecs._debug();

      expect(ecs.stats().entityCount).toEqual(0);
    });
  });
});
