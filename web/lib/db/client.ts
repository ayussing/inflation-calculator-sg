import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { getPgConnectionConfig } from "./connectionConfig";

declare global {
  // `var` is required here: `declare global` only merges `var` declarations into the global scope.
  var pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool(getPgConnectionConfig());
}

// Lazy: the pool is only created on first query, so importing this module never requires
// DATABASE_URL to be set (e.g. during `next build`, or in routes that don't touch the db).
function getPool(): Pool {
  if (globalThis.pgPool) {
    return globalThis.pgPool;
  }

  const newPool = createPool();

  // Reuse the pool across `next dev` hot reloads so we don't exhaust Aiven's connection limit.
  if (process.env.NODE_ENV !== "production") {
    globalThis.pgPool = newPool;
  }

  return newPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export type QueryFn = typeof query;

// Runs `fn` against a single checked-out client wrapped in BEGIN/COMMIT/ROLLBACK, so multiple
// statements can be committed or rolled back atomically. `fn` receives a `query`-shaped function
// bound to the transaction's client, so callers written against `QueryFn` work unmodified whether
// or not they're inside a transaction.
export async function withTransaction<T>(
  fn: (txQuery: QueryFn) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getPool().connect();
  const txQuery: QueryFn = async (text, params) => {
    const result = await client.query(text, params);
    return result.rows;
  };
  try {
    await client.query("BEGIN");
    const result = await fn(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
