import { NextResponse } from "next/server"
import { getBuildInfo } from "@/lib/buildInfo"

export async function GET() {
  try {
    // Obtener información de compilación
    const buildInfo = getBuildInfo()

    // Devolver la información de compilación
    return NextResponse.json(buildInfo)
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener información de compilación" }, { status: 500 })
  }
}

