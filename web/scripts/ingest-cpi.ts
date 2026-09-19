import { runIngestion } from "../lib/ingestion/runIngestion";

async function main() {
  const result = await runIngestion();
  console.log(`Ingestion run #${result.runId}: ${result.status}`);
  console.log(`Rows upserted: ${result.rowsUpserted}`);
  if (result.error) {
    console.error("Error:", result.error);
  }
  if (result.status !== "success") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Ingestion script failed unexpectedly:", error);
  process.exit(1);
});
