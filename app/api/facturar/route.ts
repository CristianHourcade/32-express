export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("[FACTURAR] llegó al POST");
  return NextResponse.json({ ok: true });
}
