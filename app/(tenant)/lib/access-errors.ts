export function isTenantAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("access denied")
  );
}
