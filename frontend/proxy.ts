import { NextRequest, NextResponse } from "next/server";

import { authenticateAdmin, getFanArtHttpConfig } from "./app/lib/fanart/http";
import { FanArtError } from "./app/lib/fanart/model";

const ADMIN_REALM = "MoingFans Admin";

function addAdminHeaders(response: NextResponse) {
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function unauthorizedResponse() {
  return addAdminHeaders(
    new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        "www-authenticate": `Basic realm=\"${ADMIN_REALM}\"`,
      },
    })
  );
}

function parseAuthorization(header: string | null) {
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function isFanArtAdminPath(pathname: string) {
  return pathname === "/api/admin/fanart"
    || pathname.startsWith("/api/admin/fanart/")
    || pathname === "/admin/fanart"
    || pathname.startsWith("/admin/fanart/");
}

export function proxy(request: NextRequest) {
  const username = process.env.ADMIN_BASIC_AUTH_USERNAME?.trim();
  const password = process.env.ADMIN_BASIC_AUTH_PASSWORD?.trim();

  if (isFanArtAdminPath(request.nextUrl.pathname)) {
    try {
      authenticateAdmin(request, getFanArtHttpConfig());
      return addAdminHeaders(NextResponse.next());
    } catch (error) {
      if (error instanceof FanArtError && error.status === 401) return unauthorizedResponse();
      return addAdminHeaders(
        new NextResponse("Admin access is disabled until ADMIN_BASIC_AUTH_USERNAME and ADMIN_BASIC_AUTH_PASSWORD are configured.", {
          status: 503,
        })
      );
    }
  }

  if (!username || !password) {
    if (process.env.NODE_ENV === "development") {
      return addAdminHeaders(NextResponse.next());
    }

    return addAdminHeaders(
      new NextResponse("Admin access is disabled until ADMIN_BASIC_AUTH_USERNAME and ADMIN_BASIC_AUTH_PASSWORD are configured.", {
        status: 503,
      })
    );
  }

  const credentials = parseAuthorization(request.headers.get("authorization"));
  if (!credentials || credentials.username !== username || credentials.password !== password) {
    return unauthorizedResponse();
  }

  return addAdminHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/fanart/:path*", "/api/analytics/stats", "/api/analytics/health"],
};
