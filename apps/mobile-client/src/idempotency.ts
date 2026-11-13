/**
 * Idempotency-Key for a create. A retry of the same request (same body) reuses the key, so the server returns
 * the hold the first attempt made even if its response was lost; any other body gets a fresh key.
 */
export class IdempotencyKeys {
  private body = "";
  private key = "";

  for(body: unknown): string {
    const serialized = JSON.stringify(body);
    if (serialized !== this.body) {
      this.body = serialized;
      this.key = newKey();
    }
    return this.key;
  }

  /** Call when the hold is dropped: retrying the same choice afterwards must create a new hold. */
  reset(): void {
    this.body = "";
  }
}

/** Keys are scoped per customer on the server, so random-enough is unique enough; no crypto is required. */
function newKey(): string {
  const random = () => Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${random()}${random()}`;
}
