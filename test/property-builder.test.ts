import { it, expect } from "bun:test";
import * as PropertyTracking from "../src/lib/property-builder";

it("PropertyTracking", () => {
  const $ = PropertyTracking.create({ a: 0, b: 0 }, []);

  // console.log($);

  expect(PropertyTracking.getPath($)).toEqual([]);
  expect(PropertyTracking.getPath($.a)).toEqual(["a"]);
  expect(PropertyTracking.getPath($.a.a)).toEqual(["a", "a"]);
  expect(PropertyTracking.getPath($.b)).toEqual(["b"]);
  expect(PropertyTracking.getPath($.a.b)).toEqual(["a", "b"]);
  expect(PropertyTracking.getPath($.b.a)).toEqual(["b", "a"]);

  // console.log($);
});
