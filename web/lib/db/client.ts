import { Pool, type QueryResultRow } from "pg";

declare global {
  // `var` is required here: `declare global` only merges `var` declarations into the global scope.
  var pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Aiven's connection string includes sslmode=require, which pg-connection-string now
  // treats as full certificate verification and would silently override the `ssl` option
  // below. Strip it so SSL is controlled solely by the explicit option here.
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");

  return new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
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
