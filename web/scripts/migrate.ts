import { runner } from "node-pg-migrate";
import { getPgConnectionConfig } from "../lib/db/connectionConfig";

function parseDirection(value: string | undefined): "up" | "down" {
  if (value !== "up" && value !== "down") {
    console.error("Usage: tsx scripts/migrate.ts <up|down>");
    process.exit(1);
  }
  return value;
}

const direction = parseDirection(process.argv[2]);

async function main() {
  await runner({
    databaseUrl: getPgConnectionConfig(),
    dir: "migrations",
    direction,
    migrationsTable: "pgmigrations",
    count: direction === "down" ? 1 : Infinity,
  });
}

main()
  .then(() => {
    console.log(`Migrations ${direction} complete.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
