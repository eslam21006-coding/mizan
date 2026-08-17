const asciiControlCharacter = /[\u0000-\u001f\u007f]/;
const percentEncodedControlCharacter = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const localRedirectBase = new URL("https://mizan.local");

export function safeLocalPath(value: string | null | undefined, fallback = "/") {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    asciiControlCharacter.test(value) ||
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
