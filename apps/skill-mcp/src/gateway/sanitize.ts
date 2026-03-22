/**
 * Sanitize a server key for use in MCP tool/prompt names.
 * Replaces any character not matching [a-zA-Z0-9_-] with '_'.
 */
export function sanitizeServerKey(serverKey: string): string {
  return serverKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}
