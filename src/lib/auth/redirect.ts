const percentEncodedControlCharacter = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const localRedirectBase = new URL("https://mizan.local");

function containsAsciiControlCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
}

export function safeLocalPath(value: string | null | undefined, fallback = "/") {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    containsAsciiControlCharacter(value) ||
    percentEncodedControlCharacter.test(value)
  ) {
    return fallback;
  }

  const resolved = new URL(value, localRedirectBase);
  if (resolved.origin !== localRedirectBase.origin) {
    return fallback;
  }

  return value;
}
