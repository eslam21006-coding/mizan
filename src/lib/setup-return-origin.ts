import {
  parseReturnOrigin,
  type ReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin";

export type SetupReturnOrigin = Extract<
  ReturnOriginMetadata,
  { origin: "monthly-editor" }
>;

/** Accepts only a Monthly-editor origin for cross-module setup detours. */
export function parseSetupReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): SetupReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  return parsed?.origin === "monthly-editor" ? parsed : null;
}
