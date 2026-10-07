import { AsyncLocalStorage } from "node:async_hooks";

class FrpcLifecycleGuard {
  private readonly context = new AsyncLocalStorage<object>();
  private owner: object | null = null;

  get busy(): boolean {
    return this.owner !== null;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.owner && this.context.getStore() === this.owner) {
      return operation();
    }
    if (this.owner) throw new Error("SERVICE_BUSY");
    const owner = {};
    this.owner = owner;
    // Nested service/process calls share ownership; detached work cannot reuse
    // the context after this operation has released its ownership token.
    try {
      return await this.context.run(owner, operation);
    } finally {
      this.owner = null;
    }
  }
}

export const frpcLifecycleGuard = new FrpcLifecycleGuard();
export default FrpcLifecycleGuard;
