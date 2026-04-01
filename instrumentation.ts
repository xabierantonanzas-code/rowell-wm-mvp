export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment variables
    const { validateEnvVars } = await import("@/lib/security");
    validateEnvVars();

    // Initialize Sentry server-side (only if DSN is set)
    if (process.env.SENTRY_DSN) {
      await import("./sentry.server.config");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    if (process.env.SENTRY_DSN) {
      await import("./sentry.edge.config");
    }
  }
}
