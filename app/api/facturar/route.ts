import { NextResponse } from "next/server";

export async function POST(req: Request) {
    console.log("[API] POST recibido en /api/facturar");
    const body = await req.json();

    const res = await fetch("https://www.tusfacturas.app/app/api/v2/facturacion/nuevo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    return NextResponse.json(data);
}