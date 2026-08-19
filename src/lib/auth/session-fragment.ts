export type AuthSessionFragmentType = "invite" | "recovery";

export type AuthSessionFragment = {
  accessToken: string;
  refreshToken: string;
  type: AuthSessionFragmentType;
};

function normalizeFragment(value: string) {
  return value.startsWith("#") ? value.slice(1) : value;
}

export function parseAuthSessionFragment(value: string): AuthSessionFragment | null {
  const params = new URLSearchParams(normalizeFragment(value));
  const accessToken = params.get("access_token")?.trim() ?? "";
  const refreshToken = params.get("refresh_token")?.trim() ?? "";
  const type = params.get("type");

  if (!accessToken || !refreshToken || (type !== "invite" && type !== "recovery")) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    type,
  };
}
