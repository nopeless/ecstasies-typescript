import { bench, do_not_optimize, run } from "mitata";
import { Ecstasy } from "../src";

const ecs = new Ecstasy({
  components: {
    pos: () => ({ x: 0, y: 0 }),
    vel: () => ({ x: 0, y: 0 }),
    mass: () => ({ value: 0 }),
  },
  one: 1,
});

const entityCount = 2_500_000;

for (let i = 0; i < entityCount; i++) {
  ecs.create({
    pos: { x: 1, y: i * 10 },
  });
  ecs.create({
    pos: { x: 1, y: i * 10 + 1 },
    vel: { x: i, y: i },
  });
  ecs.create({
    pos: { x: 1, y: i * 10 + 2 },
    mass: { value: i },
  });
  ecs.create({
    pos: { x: 1, y: i * 10 + 3 },
    vel: { x: i, y: i },
    mass: { value: i },
  });
}

let sumX: number;
// ecs._debug();

// bench("Query all entities with pos", () => {
//   sumX = 0;

//   const query = new ecs.Query([ecs.components.pos]);

//   for (const region of query.regions) {
//     for (let i = 0; i < region.entities.length; i++) {
//       const entity = region.entities[i]!;

//       sumX += entity.pos.x;
//     }
//   }
// });
// bench("Query all entities with pos", () => {
//   sumX = 0;

//   const query = new ecs.Query([ecs.components.pos]);

//   // @ts-ignore
//   for (const entity of query) {
//     sumX += entity.pos.x;
//   }
// });
// bench("Query all entities with pos", () => {
//   sumX = 0;

//   const query = new ecs.Query([ecs.components.pos]);

//   query.forEach((e, _) => {
//     sumX += e.pos.x;
//   });
// });
bench("query iterator", () => {
  sumX = 0;

  const query = ecs.query(ecs.$.pos);

  for (const entity of query) {
    sumX += entity.pos.x;
  }
});

await run();

console.log("Sum of pos.x:", sumX!);
