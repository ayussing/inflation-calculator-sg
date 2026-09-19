import { query } from "../lib/db/client";

async function main() {
  const rows = await query<{ now: Date; version: string }>(
    "SELECT now(), version()"
  );
  console.log("Connected to Postgres.");
  console.log("Server time:", rows[0].now);
  console.log("Version:", rows[0].version);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });
