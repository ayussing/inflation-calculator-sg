import { NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestion/runIngestion";

export async function GET(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { status: "error", message: "INGEST_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (provided !== secret) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngestion();
    return NextResponse.json(result, { status: result.status === "success" ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
