// Accept the invitation code or the full setup link copied from the admin panel.
export function parsePasswordSetup(value: string): { setupToken: string; email?: string } {
  const input = value.trim();
  if (!input) return { setupToken: "" };
  try {
    const url = new URL(input);
    return { setupToken: url.searchParams.get("setupToken") || "", email: url.searchParams.get("email") || undefined };
  } catch {
    return { setupToken: input };
  }
}
