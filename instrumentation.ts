export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment variables
    const { validateEnvVars } = await import("@/lib/security");
    validateEnvVars();

    // Initialize Sentry server-side
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
