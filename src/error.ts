export class EcstasyError extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args);
    this.name = "EcstasyError";
  }
}
