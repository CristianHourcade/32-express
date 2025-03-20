import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("diagnoseUserEmployee")

export async function GET(request: Request) {
  try {
    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Se requiere un email para el diagnóstico" }, { status: 400 })
    }

    logger.info("Iniciando diagnóstico para email", { email })

    // 1. Buscar usuario en auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email)

    if (authError) {
      logger.error("Error al buscar usuario en auth", { error: authError.message })
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 2. Buscar usuario en tabla users
    const { data: dbUser, error: dbUserError } = await supabase.from("users").select("*").eq("email", email).single()

    if (dbUserError && dbUserError.code !== "PGRST116") {
      logger.error("Error al buscar usuario en tabla users", { error: dbUserError.message })
    }

    // 3. Buscar empleado en tabla employees
    let employee = null
    let employeeError = null

    try {
      const { data: employees } = await supabase.from("employees").select("*, businesses(name)").eq("email", email)

      if (employees && employees.length > 0) {
        employee = employees[0]
      }
    } catch (err) {
      employeeError = err
      logger.error("Error al buscar empleado", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    if (employeeError && employeeError.code !== "PGRST116") {
      logger.error("Error al buscar empleado", { error: employeeError.message })
    }

    // 4. Si encontramos el empleado y el usuario de auth, verificar si están vinculados
    let linkStatus = "No aplicable"
    let linkProblem = null

    if (authUser?.user && employee) {
      if (employee.user_id === authUser.user.id) {
        linkStatus = "Vinculados correctamente"
      } else {
        linkStatus = "No vinculados"
        linkProblem = "El campo user_id del empleado no coincide con el ID del usuario de auth"

        // Verificar si el empleado tiene algún user_id
        if (!employee.user_id) {
          linkProblem = "El empleado no tiene user_id asignado"
        } else {
          // Verificar si el user_id apunta a un usuario válido
          const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(employee.user_id)

          if (linkedUserError || !linkedUser) {
            linkProblem = `El user_id del empleado (${employee.user_id}) no corresponde a un usuario válido`
          } else {
            linkProblem = `El user_id del empleado apunta a otro usuario: ${linkedUser.user.email}`
          }
        }
      }
    }

    // 5. Preparar respuesta con diagnóstico
    const diagnosis = {
      email,
      authUser: authUser?.user
        ? {
            id: authUser.user.id,
            email: authUser.user.email,
            userMetadata: authUser.user.user_metadata,
            createdAt: authUser.user.created_at,
          }
        : null,
      dbUser: dbUser || null,
      employee: employee
        ? {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            userId: employee.user_id,
            businessId: employee.business_id,
            businessName: employee.businesses?.name,
          }
        : null,
      linkStatus,
      linkProblem,
      recomendaciones: [],
    }

    // 6. Añadir recomendaciones basadas en el diagnóstico
    if (!authUser?.user) {
      diagnosis.recomendaciones.push("Crear usuario de autenticación para este email")
    }

    if (!employee) {
      diagnosis.recomendaciones.push("Crear registro de empleado para este email")
    } else if (!employee.user_id && authUser?.user) {
      diagnosis.recomendaciones.push(
        `Actualizar el user_id del empleado con el ID del usuario de auth: ${authUser.user.id}`,
      )
    } else if (employee.user_id && authUser?.user && employee.user_id !== authUser.user.id) {
      diagnosis.recomendaciones.push(
        `Corregir el user_id del empleado para que coincida con el ID del usuario de auth: ${authUser.user.id}`,
      )
    }

    logger.info("Diagnóstico completado", {
      email,
      tieneAuthUser: !!authUser?.user,
      tieneDbUser: !!dbUser,
      tieneEmployee: !!employee,
      linkStatus,
    })

    return NextResponse.json(diagnosis)
  } catch (error) {
    logger.error("Error en diagnóstico", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al realizar diagnóstico: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

