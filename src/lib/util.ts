export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export function assert<_ extends true>(
  condition: unknown = true,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
