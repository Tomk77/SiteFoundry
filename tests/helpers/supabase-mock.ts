import { vi } from "vitest";

export interface MockQueryResult<T = unknown> {
  data: T;
  error: Error | null;
  count?: number | null;
}

interface MockCall {
  method: string;
  args: unknown[];
}

function result<T>(data: T, error: Error | null = null): MockQueryResult<T> {
  return { data, error };
}

class MockQueryBuilder implements PromiseLike<MockQueryResult> {
  constructor(
    private readonly value: MockQueryResult,
    private readonly calls: MockCall[],
  ) {}

  private chain(method: string, args: unknown[]) {
    this.calls.push({ method, args });

    return this;
  }

  select(...args: unknown[]) {
    return this.chain("select", args);
  }

  insert(...args: unknown[]) {
    return this.chain("insert", args);
  }

  update(...args: unknown[]) {
    return this.chain("update", args);
  }

  delete(...args: unknown[]) {
    return this.chain("delete", args);
  }

  eq(...args: unknown[]) {
    return this.chain("eq", args);
  }

  in(...args: unknown[]) {
    return this.chain("in", args);
  }

  order(...args: unknown[]) {
    return this.chain("order", args);
  }

  limit(...args: unknown[]) {
    return this.chain("limit", args);
  }

  single() {
    this.calls.push({ method: "single", args: [] });

    return Promise.resolve(this.value);
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: [] });

    return Promise.resolve(this.value);
  }

  then<TResult1 = MockQueryResult, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.value).then(onfulfilled, onrejected);
  }
}

export function createSupabaseMock(
  input: {
    tables?: Record<string, MockQueryResult[]>;
    rpc?: Record<string, MockQueryResult[]>;
  } = {},
) {
  const tableQueues = Object.fromEntries(
    Object.entries(input.tables ?? {}).map(([table, values]) => [table, [...values]]),
  );
  const rpcQueues = Object.fromEntries(
    Object.entries(input.rpc ?? {}).map(([name, values]) => [name, [...values]]),
  );
  const calls: MockCall[] = [];
  const auth = {
    updateUser: vi.fn().mockResolvedValue(result(null)),
    signInWithPassword: vi.fn().mockResolvedValue(result(null)),
  };
  const client = {
    auth,
    from: vi.fn((table: string) => {
      calls.push({ method: "from", args: [table] });
      const value = tableQueues[table]?.shift() ?? result([]);

      return new MockQueryBuilder(value, calls);
    }),
    rpc: vi.fn((name: string, args?: unknown) => {
      calls.push({ method: "rpc", args: [name, args] });

      return Promise.resolve(rpcQueues[name]?.shift() ?? result(null));
    }),
  };

  return { client, calls, auth, result };
}

export const mockResult = result;
