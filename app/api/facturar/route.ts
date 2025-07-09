import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("[API] POST recibido en /api/facturar");

  try {
    const body = await request.json();
    console.log("[API] Body recibido:", body);

    // Test de respuesta local
    return NextResponse.json({ status: "ok", received: body });

    // Si querés usar el fetch real, descomentá esto:
    /*
    const res = await fetch("https://www.tusfacturas.app/app/api/v2/facturacion/nuevo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
    */
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json({ error: "Error procesando la solicitud" }, { status: 500 });
  }
}
