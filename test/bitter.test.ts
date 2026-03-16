import { describe, expect, test } from "bun:test";
import { Bitter } from "../src";

describe("Bitter", () => {
  test("main", () => {
    const bitter = new Bitter({
      capacity: 1e6,
      components: {
        position: {
          x: Float64Array,
          y: Float64Array,
        },
        velocity: {
          x: Float64Array,
          y: Float64Array,
        },
      },
    });

    console.log(bitter.components);

    const e1 = bitter.create();

    bitter.archetype[e1]! |= bitter.bit.position | bitter.bit.velocity;

    bitter.components.position.x[e1] = 0;
    bitter.components.position.y[e1] = 0;
    bitter.components.velocity.x[e1] = 1;
    bitter.components.velocity.y[e1] = 1;
  });
});
