import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error to Sentry and console.
 */
export function captureError(error: unknown, context?: string) {
  const message = context ? `[${context}] ${String(error)}` : String(error);
  console.error(message, error);
  Sentry.captureException(error, {
    tags: { context: context ?? "unknown" },
  });
}
