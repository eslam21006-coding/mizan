import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getRoleFromClaims } from "@/lib/auth/role";
import { getSupabasePublicConfig } from "./config";

const publicPaths = new Set(["/login", "/access-denied"]);

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname) || pathname.startsWith("/auth/");
}

function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
  search?: URLSearchParams,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search?.toString() ?? "";

  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });

  for (const headerName of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(headerName);
    if (value) {
      redirectResponse.headers.set(headerName, value);
    }
  }

  return redirectResponse;
}

export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);

  if (!claims) {
    if (publicPath) {
      return supabaseResponse;
    }

    const search = new URLSearchParams({ next: `${pathname}${request.nextUrl.search}` });
    return redirectWithSession(request, supabaseResponse, "/login", search);
  }

  const role = getRoleFromClaims(claims);
  if (!role) {
    if (pathname === "/access-denied" || pathname.startsWith("/auth/")) {
      return supabaseResponse;
    }

    return redirectWithSession(request, supabaseResponse, "/access-denied");
  }

  if (pathname === "/login" || pathname === "/access-denied") {
    return redirectWithSession(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}
