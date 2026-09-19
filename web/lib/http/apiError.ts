import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Thrown by route handlers to signal a specific HTTP status; caught by toErrorResponse so each
// route's error handling is one `catch (e) { return toErrorResponse(e); }` instead of a repeated
// instanceof chain.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { status: "error", message: error.message, ...(error.details !== undefined && { details: error.details }) },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { status: "error", message: "Invalid request", details: error.flatten() },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
    { status: 500 }
  );
}
