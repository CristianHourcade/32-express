import { NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("error-api")

export async function POST(request: Request) {
  try {
    const errorData = await request.json()

    // Registrar el error con detalles
    logger.error("Error del cliente capturado", {
      ...errorData,
      source: "client-error-boundary",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error procesando log de error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

