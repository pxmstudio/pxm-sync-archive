import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ApiException } from "../lib/errors.js";
import type { Env, Variables } from "../types.js";

// Check if error is a ZodError by checking for issues property
function isZodError(err: unknown): err is { issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    err !== null &&
    typeof err === "object" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}

export const errorHandler: ErrorHandler<{ Bindings: Env; Variables: Variables }> = (
  err,
  c
) => {
  console.error("Error:", err);

  // Handle ApiException (our custom errors)
  if (err instanceof ApiException) {
    return c.json(err.toJSON(), err.status);
  }

  // Handle Zod validation errors
  if (isZodError(err)) {
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: {
            issues: err.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      },
      400
    );
  }

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: err.message,
        },
      },
      err.status
    );
  }

  // Handle unknown errors
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message || "Unknown error",
      },
    },
    500
  );
};
