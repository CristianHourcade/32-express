import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { createModuleLogger } from "@/lib/serverLogger"
import { employeeService } from "@/services/admin/employeeService"

const logger = createModuleLogger("fixEmployeeUserId")

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, userId } = body

    if (!employeeId || !userId) {
      return NextResponse.json({ error: "Se requieren employeeId y userId" }, { status: 400 })
    }

    logger.info("Corrigiendo relación empleado-usuario", { employeeId, userId })

    // Verificar que el empleado existe
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single()

    if (employeeError) {
      logger.error("Error al verificar empleado", { error: employeeError.message })
      return NextResponse.json({ error: `No se encontró el empleado: ${employeeError.message}` }, { status: 404 })
    }

    // Verificar que el usuario existe
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)

    if (authError || !authUser?.user) {
      logger.error("Error al verificar usuario de auth", {
        error: authError?.message || "Usuario no encontrado",
      })
      return NextResponse.json(
        { error: `No se encontró el usuario de auth: ${authError?.message || "Usuario no encontrado"}` },
        { status: 404 },
      )
    }

    // Actualizar el user_id del empleado
    try {
      const updatedEmployee = await employeeService.updateEmployeeUserId(employeeId, userId)

      logger.info("Relación corregida exitosamente", {
        employeeId,
        userId,
        employeeName: employee.name,
        userEmail: authUser.user.email,
      })

      return NextResponse.json({
        success: true,
        message: "Relación corregida exitosamente",
        employee: updatedEmployee,
      })
    } catch (updateError) {
      logger.error("Error al actualizar user_id del empleado", {
        error: updateError instanceof Error ? updateError.message : String(updateError),
      })
      return NextResponse.json(
        { error: `Error al actualizar: ${updateError instanceof Error ? updateError.message : String(updateError)}` },
        { status: 500 },
      )
    }
  } catch (error) {
    logger.error("Error al corregir relación", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al corregir relación: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

