import { NextResponse } from "next/server";
import { getAllSeries } from "@/lib/cpi/repository";
import { CategoriesResponseSchema } from "@/lib/cpi/schema";
import { toErrorResponse } from "@/lib/http/apiError";

export async function GET() {
  try {
    const categories = await getAllSeries();
    const response = CategoriesResponseSchema.parse({ categories });
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
