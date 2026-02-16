const $path = Symbol("PropertyAccessPath");
const $ext = Symbol("External");

type PropertyBuilder<O, P = never> = {
  [K in keyof O]: PropertyBuilder<O, K | P>;
};

export type { PropertyBuilder as T };

/** Fast, non-proxy based object path calculator with caching */
export function create<O>(obj: O, path: unknown[] = []): PropertyBuilder<O> {
  // @ts-expect-error
  return Object.defineProperties(
    { [$path]: path, [$ext]: undefined },
    Object.fromEntries(
      Object.keys(
        // @ts-expect-error
        obj,
      ).map((k) => [
        k,
        {
          get() {
            const value = create(obj, [...path, k]);
            Object.defineProperty(this, k, {
              value,
              writable: false,
              enumerable: true,
            });
            return value;
          },
          configurable: true,
          enumerable: true,
        },
      ]),
    ),
  );
}

export function getPath<P>(query: PropertyBuilder<unknown, P>): P[] {
  // @ts-ignore
  return query[$path];
}

export function getExternal<P>(query: PropertyBuilder<unknown, P>): P {
  // @ts-ignore
  return query[$ext];
}

export function setExternal<P>(query: PropertyBuilder<unknown, P>, value: P): void {
  // @ts-ignore
  query[$ext] = value;
}
