export type PgConnectionConfig = {
  connectionString: string;
  ssl: { rejectUnauthorized: false };
};

// Aiven's connection string includes sslmode=require, which pg-connection-string now
// treats as full certificate verification and would silently override the `ssl` option
// below. Strip it so SSL is controlled solely by the explicit option here. Shared by the
// app's pool (client.ts) and the migration runner (scripts/migrate.ts), which each need
// their own pg connection.
export function getPgConnectionConfig(): PgConnectionConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");

  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  };
}
