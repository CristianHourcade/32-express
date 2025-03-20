import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    // Aquí puedes implementar cualquier lógica de limpieza que necesites
    console.log("Ejecutando limpieza programada de caché")

    // Puedes agregar lógica para invalidar cachés específicos si es necesario

    return NextResponse.json({
      success: true,
      message: "Limpieza de caché ejecutada correctamente",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error durante la limpieza de caché:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error durante la limpieza de caché",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

