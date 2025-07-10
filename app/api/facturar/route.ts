export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("[API] POST recibido en /api/facturar");

    const body = await req.json();
    console.log("[API] Body recibido:", body);

    const res = await fetch("https://www.tusfacturas.app/app/api/v2/facturacion/nuevo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("[API] Response status:", res.status);

    const data = await res.json();
    console.log("[API] Data recibida:", data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API ERROR]", error?.message || error);
    return NextResponse.json({ error: "Error interno en el servidor", details: error?.message || error }, { status: 500 });
  }
}
