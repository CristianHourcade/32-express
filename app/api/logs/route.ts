import { type NextRequest, NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("client-logs-api")

export async function POST(request: NextRequest) {
  try {
    const logData = await request.json()

    // Validar datos mínimos requeridos
    if (!logData.level || !logData.message) {
      return NextResponse.json({ error: "Datos de log incompletos" }, { status: 400 })
    }

    // Registrar el log del cliente en el servidor
    logger.info(`Log del cliente: [${logData.level}] ${logData.message}`, {
      ...logData.context,
      clientInfo: {
        userAgent: logData.userAgent,
        url: logData.url,
        timestamp: logData.timestamp,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error procesando log del cliente", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

