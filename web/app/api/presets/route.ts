import { NextResponse } from "next/server";
import { getAllPresets } from "@/lib/presets/repository";
import { PresetsResponseSchema } from "@/lib/presets/schema";
import { toErrorResponse } from "@/lib/http/apiError";

export async function GET() {
  try {
    const presets = await getAllPresets();
    const response = PresetsResponseSchema.parse({ presets });
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
