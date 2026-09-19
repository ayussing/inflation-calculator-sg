import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi/document";

export async function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
