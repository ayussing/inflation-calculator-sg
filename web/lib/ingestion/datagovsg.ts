const DATASET_API_BASE = "https://api-open.data.gov.sg/v1/public/api/datasets";

export type DownloadCsvOptions = {
  datasetId: string;
  apiKey?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

// Verified 2026-09-19 with a live call against d_bdaff844e3ef89d39fceb962ff8f0791 (no API key):
// - GET .../initiate-download works with no request body and returns 201 with
//   {code:0, data:{message, url}} — it already includes a signed url, but we still poll
//   poll-download per the documented two-step flow rather than trusting initiate's url directly,
//   since larger datasets may not have it ready yet.
// - GET .../poll-download also works with no request body and returns 201 with
//   {code:0, data:{status:"DOWNLOAD_SUCCESS", url}} — the success status string is
//   "DOWNLOAD_SUCCESS", NOT "COMPLETED" as data.gov.sg's own guide text vaguely suggests.
// Still unverified (no API key was available to test): the exact key header name — data.gov.sg's
// guide doesn't document it. `x-api-key` below is a best-effort default; confirm against a real
// key before relying on the higher authenticated rate limit.
type InitiateDownloadResponse = {
  code: number;
  data?: { message?: string; url?: string };
  errorMsg?: string;
};

type PollDownloadResponse = {
  code: number;
  data?: { status?: string; url?: string };
  errorMsg?: string;
};

export async function downloadDatasetCsv(options: DownloadCsvOptions): Promise<string> {
  const { datasetId, apiKey, pollIntervalMs = 2000, pollTimeoutMs = 60_000 } = options;
  const headers: Record<string, string> = apiKey ? { "x-api-key": apiKey } : {};

  const initiateRes = await fetch(`${DATASET_API_BASE}/${datasetId}/initiate-download`, {
    method: "GET",
    headers,
  });
  if (!initiateRes.ok) {
    throw new Error(
      `Failed to initiate download for dataset ${datasetId}: ${initiateRes.status}`
    );
  }
  const initiateBody = (await initiateRes.json()) as InitiateDownloadResponse;
  if (initiateBody.code !== 0) {
    throw new Error(
      `data.gov.sg rejected initiate-download for dataset ${datasetId}: ${initiateBody.errorMsg ?? "unknown error"}`
    );
  }

  const deadline = Date.now() + pollTimeoutMs;
  let downloadUrl: string | null = null;

  while (Date.now() < deadline) {
    const pollRes = await fetch(`${DATASET_API_BASE}/${datasetId}/poll-download`, {
      method: "GET",
      headers,
    });
    if (!pollRes.ok) {
      throw new Error(`Failed to poll download for dataset ${datasetId}: ${pollRes.status}`);
    }

    const body = (await pollRes.json()) as PollDownloadResponse;
    if (body.code === 0 && body.data?.status === "DOWNLOAD_SUCCESS" && body.data.url) {
      downloadUrl = body.data.url;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (!downloadUrl) {
    throw new Error(`Timed out waiting for dataset ${datasetId} download to be ready`);
  }

  const csvRes = await fetch(downloadUrl);
  if (!csvRes.ok) {
    throw new Error(`Failed to download CSV for dataset ${datasetId}: ${csvRes.status}`);
  }
  return csvRes.text();
}
