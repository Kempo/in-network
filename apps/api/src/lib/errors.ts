/** Request couldn't be resolved to known plan/provider data — a 404, not a 500. */
export class ResolveError extends Error {}

/** A live directory run is required but the caller didn't supply the fields it needs. */
export class MissingInputsError extends Error {
  constructor(public missing: string[]) {
    super(`missing inputs: ${missing.join(", ")}`);
  }
}
