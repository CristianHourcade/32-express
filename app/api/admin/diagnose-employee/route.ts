import { type NextRequest, NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"
import { supabase } from "@/lib/supabase"

const logger = createModuleLogger("diagnose-employee-api")

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Se requiere un email para el diagnóstico" }, { status: 400 })
    }

    logger.info("Iniciando diagnóstico de empleado", { email })

    // 1. Verificar si existe un usuario de autenticación con ese email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email)

    if (authError) {
      logger.error("Error al buscar usuario de autenticación", {
        email,
        error: authError.message,
      })
      return NextResponse.json({ error: "Error al buscar usuario de autenticación" }, { status: 500 })
    }

    // 2. Verificar si existe un registro en la tabla users
    const { data: userRecord, error: userError } = await supabase.from("users").select("*").eq("email", email).single()

    if (userError && userError.code !== "PGRST116") {
      logger.error("Error al buscar registro en tabla users", {
        email,
        error: userError.message,
      })
    }

    // 3. Verificar si existe un registro en la tabla employees
    // Buscar empleado por email (insensible a mayúsculas/minúsculas)
    const { data: employeeRecord, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .ilike("email", email) // ilike hace la búsqueda insensible a mayúsculas/minúsculas
      .single()

    if (employeeError && employeeError.code !== "PGRST116") {
      logger.error("Error al buscar registro en tabla employees", {
        email,
        error: employeeError.message,
      })
    }

    // 4. Verificar si el user_id en employees coincide con el auth_id
    let userIdMatch = false
    if (authUser?.user && employeeRecord) {
      userIdMatch = authUser.user.id === employeeRecord.user_id

      if (!userIdMatch) {
        logger.warn("El user_id en employees no coincide con el auth_id", {
          email,
          authUserId: authUser.user.id,
          employeeUserId: employeeRecord.user_id || "No asignado",
        })
      }
    }

    // Preparar resultado del diagnóstico
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
      userRecord: userRecord || null,
      employeeRecord: employeeRecord || null,
      userIdMatch,
      problems: [],
    }

    // Identificar problemas
    if (!authUser?.user) {
      diagnosis.problems.push("No existe un usuario de autenticación con este email")
    }

    if (!userRecord) {
      diagnosis.problems.push("No existe un registro en la tabla users con este email")
    }

    if (!employeeRecord) {
      diagnosis.problems.push("No existe un registro en la tabla employees con este email")
    } else if (!employeeRecord.user_id) {
      diagnosis.problems.push("El registro de empleado no tiene un user_id asignado")
    } else if (authUser?.user && employeeRecord.user_id !== authUser.user.id) {
      diagnosis.problems.push("El user_id del empleado no coincide con el ID del usuario de autenticación")
    }

    logger.info("Diagnóstico completado", {
      email,
      hasAuthUser: !!authUser?.user,
      hasUserRecord: !!userRecord,
      hasEmployeeRecord: !!employeeRecord,
      userIdMatch,
      problemsCount: diagnosis.problems.length,
    })

    // Return a simplified response without detailed debugging information
    return NextResponse.json({
      diagnosis: {
        hasUserId: !!employeeRecord?.user_id,
        userExists: !!userRecord,
        authUserExists: !!authUser?.user,
        issues: diagnosis.problems,
      },
      employee: employeeRecord
        ? {
            id: employeeRecord.id,
            name: employeeRecord.name,
            email: employeeRecord.email,
            user_id: employeeRecord.user_id,
          }
        : null,
      userData: userRecord
        ? {
            name: userRecord.name,
            email: userRecord.email,
          }
        : null,
      authUserData: authUser?.user
        ? {
            email: authUser.user.email,
          }
        : null,
    })
  } catch (error) {
    logger.error("Error en diagnóstico de empleado", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, action } = body

    if (!email) {
      return NextResponse.json({ error: "Se requiere un email para la corrección" }, { status: 400 })
    }

    if (action !== "fix-user-id") {
      return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
    }

    logger.info("Iniciando corrección de vinculación de empleado", { email, action })

    // 1. Obtener el usuario de autenticación
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email)

    if (authError || !authUser?.user) {
      logger.error("Error al buscar usuario de autenticación", {
        email,
        error: authError?.message || "Usuario no encontrado",
      })
      return NextResponse.json({ error: "No se encontró el usuario de autenticación" }, { status: 404 })
    }

    // 2. Obtener el registro de empleado
    const { data: employeeRecord, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .ilike("email", email)
      .single()

    if (employeeError || !employeeRecord) {
      logger.error("Error al buscar registro en tabla employees", {
        email,
        error: employeeError?.message || "Empleado no encontrado",
      })
      return NextResponse.json({ error: "No se encontró el registro de empleado" }, { status: 404 })
    }

    // 3. Actualizar el user_id en el registro de empleado
    const { data: updatedEmployee, error: updateError } = await supabase
      .from("employees")
      .update({ user_id: authUser.user.id })
      .eq("id", employeeRecord.id)
      .select()
      .single()

    if (updateError) {
      logger.error("Error al actualizar user_id en empleado", {
        email,
        employeeId: employeeRecord.id,
        authUserId: authUser.user.id,
        error: updateError.message,
      })
      return NextResponse.json({ error: "Error al actualizar el registro de empleado" }, { status: 500 })
    }

    logger.info("Vinculación de empleado corregida exitosamente", {
      email,
      employeeId: employeeRecord.id,
      authUserId: authUser.user.id,
    })

    return NextResponse.json({
      success: true,
      message: "Vinculación corregida exitosamente",
      employee: {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
      },
    })
  } catch (error) {
    logger.error("Error en corrección de vinculación de empleado", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

