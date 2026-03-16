import { bench, run } from "mitata";
import { Bitter } from "../src";

const ITERATIONS = 60;
const ENTITY_COUNT = 100_000;

const bitter = new Bitter({
  capacity: ENTITY_COUNT,
  components: {
    position: {
      x: Float64Array,
      y: Float64Array,
    },
    velocity: {
      x: Float64Array,
      y: Float64Array,
    },
    acceleration: Float64Array,
    mass: Float64Array,
  },
});

// create a simple collision system
for (let i = 0; i < ENTITY_COUNT; i++) {
  const id = bitter.create();
  bitter.components.position.x[id] = Math.random() * 100;
  bitter.components.position.y[id] = Math.random() * 100;
  bitter.components.velocity.x[id] = (Math.random() - 0.5) * 10;
  bitter.components.velocity.y[id] = (Math.random() - 0.5) * 10;
  bitter.components.acceleration[id] = 0;
  bitter.components.mass[id] = Math.random() * 10 + 1;
}

const queryMovement = bitter.bit.position | bitter.bit.velocity;

const systemFriction = () => {
  for (let id = 0; id < bitter.entitiesLength; id++) {
    if ((bitter.archetype[id]! & queryMovement) === queryMovement) {
      bitter.components.acceleration[id]! =
        -0.1 *
        Math.sqrt(bitter.components.velocity.x[id]! ** 2 + bitter.components.velocity.y[id]! ** 2);
    }
  }
};

const systemVelocityUpdate = () => {
  for (let id = 0; id < bitter.entitiesLength; id++) {
    if ((bitter.archetype[id]! & queryMovement) === queryMovement) {
      bitter.components.velocity.x[id]! += bitter.components.acceleration[id]!;
      bitter.components.velocity.y[id]! += bitter.components.acceleration[id]!;
    }
  }
};

const systemMovementUpdate = () => {
  for (let id = 0; id < bitter.entitiesLength; id++) {
    if ((bitter.archetype[id]! & queryMovement) === queryMovement) {
      bitter.components.position.x[id]! += bitter.components.velocity.x[id]!;
      bitter.components.position.y[id]! += bitter.components.velocity.y[id]!;
    }
  }
};

bench("bitter", () => {
  for (let i = 0; i < ITERATIONS; i++) {
    systemFriction();
    systemVelocityUpdate();
    systemMovementUpdate();
  }
});

await run();
