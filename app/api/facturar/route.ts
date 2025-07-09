import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("[API] POST /api/facturar");

  try {
    const data = await request.json();
    return NextResponse.json({
      ok: true,
      received: data,
      env: process.env.NODE_ENV,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error procesando el body", detail: String(err) },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({ message: "GET /api/facturar funciona" });
}
