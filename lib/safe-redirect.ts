/** Only same-site paths are allowed as a post-sign-in destination, so a crafted link can't send people elsewhere. */
export function safeCallbackPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
