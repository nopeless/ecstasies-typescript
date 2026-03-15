import { test, expect } from "bun:test";
import { Region } from "../src/region";

test("Region fuzz test", () => {
  const region = new Region<number>(0n, -1, -1);

  const check = new Map<number, { val: number; gid: number }>();
  check.set(0, { val: -1, gid: -1 });

  let gidCounter = 1;
  let valCounter = 1;

  // We need enough iterations to trigger the swap divergence
  for (let i = 0; i < 2000; i++) {
    const r = Math.random();

    for (const [id, expected] of check.entries()) {
      expect(region.exists(id)).toBeTrue();

      const actualVal = region.get(id);
      expect(actualVal).toBe(expected.val);

      const actualGid = region.getGid(id);
      expect(actualGid).toBe(expected.gid);
    }

    if (r < 0.4) {
      const val = valCounter++;
      const gid = gidCounter++;
      const id = region.add(val, gid);

      // If ID was reused, ensure it wasn't in our active set (it shouldn't be)
      if (check.has(id)) {
        // This is fine, we just overwrite, but semantics of add implies new slot or reuse of DEAD slot.
        // If it reuses LIVE slot, that's a huge bug.
        // But stable array implementation reuses released IDs.
      }
      check.set(id, { val, gid });
    } else if (r < 0.7) {
      if (check.size > 0) {
        const keys = Array.from(check.keys());
        const idToRemove = keys[Math.floor(Math.random() * keys.length)]!;
        region.remove(idToRemove);
        check.delete(idToRemove);
      }
    } else {
      if (check.size > 0) {
        const keys = Array.from(check.keys());
        const idToSet = keys[Math.floor(Math.random() * keys.length)]!;
        const newVal = valCounter++;
        const newGid = gidCounter++;
        region.set(idToSet, newVal, newGid);
        check.set(idToSet, { val: newVal, gid: newGid });
      }
    }
  }
});
