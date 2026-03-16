import { bench, run } from "mitata";
import { Bitter } from "../src";

const ITERATIONS = 60;
const ENTITY_COUNT = 50_000;

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
  bitter.archetype[id] =
    bitter.bit.position | bitter.bit.velocity | bitter.bit.acceleration | bitter.bit.mass;
  bitter.components.position.x[id] = Math.random() * 100;
  bitter.components.position.y[id] = Math.random() * 100;
  bitter.components.velocity.x[id] = (Math.random() - 0.5) * 10;
  bitter.components.velocity.y[id] = (Math.random() - 0.5) * 10;
  bitter.components.acceleration[id] = 0;
  bitter.components.mass[id] = Math.random() * 10 + 1;
}

const queryMovement = bitter.bit.position | bitter.bit.velocity;

const acc = bitter.components.acceleration;
const velX = bitter.components.velocity.x;
const velY = bitter.components.velocity.y;
const posX = bitter.components.position.x;
const posY = bitter.components.position.y;
const arch = bitter.archetype;
const len = bitter.entitiesLength;
const mask = queryMovement;

const systemFrictionStandard = () => {
  for (let id = 0; id < len; id++) {
    if ((arch[id]! & mask) === mask) {
      acc[id]! = -0.1 * Math.sqrt(velX[id]! ** 2 + velY[id]! ** 2);
    }
  }
};

const systemVelocityUpdateStandard = () => {
  for (let id = 0; id < len; id++) {
    if ((arch[id]! & mask) === mask) {
      velX[id]! += acc[id]!;
      velY[id]! += acc[id]!;
    }
  }
};

const systemMovementUpdateStandard = () => {
  for (let id = 0; id < len; id++) {
    if ((arch[id]! & mask) === mask) {
      posX[id]! += velX[id]!;
      posY[id]! += velY[id]!;
    }
  }
};

bench("bitter", () => {
  for (let i = 0; i < ITERATIONS; i++) {
    systemFrictionStandard();
    systemVelocityUpdateStandard();
    systemMovementUpdateStandard();
  }
});

await run({
  format: "markdown",
});
