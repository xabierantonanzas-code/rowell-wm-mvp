export async function register() {
  // Validate environment variables on app startup (server-side only)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvVars } = await import("@/lib/security");
    validateEnvVars();
  }
}
