# Query Combination situations

- all entities with components x, y, z against every other entities with components x, y, z; n^2, powerset

```ts
query.forEach(e1 => {
  query.forEach(e2 => {
    // e1 against e2
  });
});
```

- all entities with components x, y, z against every other entities with components x, y, z, but only ordered pairs, excluding pairs of same (n + 1) * n / 2

```ts
query.forEachCombination((e1, e2) => {
  // e1 against e2
});
```

- all entities with components x, y, z against every other entities with components x, y, z, but only ordered pairs, including pairs of same (n - 1) * n / 2

```ts
query.forEachCombination((e1, e2) => {
  // e1 against e2
}, true);
```

- all entities with components x, y, z against every entity with components w

```ts
queryA.forEach(e1 => {
  queryB.forEach(e2 => {
    // e1 against e2
  });
});
```

# Query Performance

I believe that no matter what you choose, the performance issue will be on whatever code runs on top of this. But here are the raw numbers. Note that actual behavior *will* be different and you should never base your decision on this benchmark alone. For example, setting the benchmark up takes 10 seconds.

For 10 million entities, 4 different shapes

```ts
// ~90ms
bench("Query raw loops", () => {
  const query = new ecs.Query([ecs.components.pos]);

  for (const region of query.regions) {
    for (let i = 0; i < region.entities.length; i++) {
      const entity = region.entities[i]!;

      sumX += entity.pos.x;
    }
  }
});

// ~150ms
bench("Query .forEach", () => {
  const query = new ecs.Query([ecs.components.pos]);

  query.forEach((e, _) => {
    sumX += e.pos.x;
  });
});

// ~210ms
bench("Query iterator", () => {
  const query = new ecs.Query([ecs.components.pos]);

  for (const entity of query) {
    sumX += entity.pos.x;
  }
});

bench("query iterator", () => {
  const query = ecs.query(ecs.$.pos);

  for (const entity of query) {
    sumX += entity.pos.x;
  }
})
```
