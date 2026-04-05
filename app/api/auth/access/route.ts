import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAccessLevel } from "@/lib/auth/access";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof NextResponse) {
    // Not authenticated — return public access
    return NextResponse.json(await getAccessLevel(null));
  }

  const access = await getAccessLevel(session.address);
  return NextResponse.json(access);
}
