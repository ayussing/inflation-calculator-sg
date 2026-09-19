import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
