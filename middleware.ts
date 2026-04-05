import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://claudia.wtf",
  "https://app.claudia.wtf",
  "https://www.claudia.wtf",
];

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // roast.claudia.wtf → serve /roast page
  if (host.startsWith("roast.claudia.wtf") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/roast", request.url));
  }

  const origin = request.headers.get("origin");
  const isPreflight = request.method === "OPTIONS";

  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow requests with no origin (server-to-server, curl, cron)
  if (!origin) {
    return NextResponse.next();
  }

  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (isPreflight) {
    const response = new NextResponse(null, { status: isAllowed ? 204 : 403 });
    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-scanner-secret");
      response.headers.set("Access-Control-Max-Age", "86400");
    }
    return response;
  }

  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg|claudia-logo\\.svg).*)"],
};
