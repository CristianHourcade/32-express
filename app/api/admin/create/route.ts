import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, businessId } = await request.json()

    // Validar datos
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Faltan datos requeridos: email, password, name" }, { status: 400 })
    }

    // Crear cliente de Supabase con clave de servicio
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "",
    )

    // Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: role || "employee",
        businessId: businessId || null,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Si el usuario se creó correctamente, crear entrada en la tabla users
    if (authData.user) {
      const { error: dbError } = await supabaseAdmin.from("users").insert({
        auth_id: authData.user.id,
        name,
        email,
        role: role || "employee",
        business_id: businessId || null,
      })

      if (dbError) {
        // Si hay error al crear en la tabla, intentar eliminar el usuario de Auth
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: dbError.message }, { status: 500 })
      }

      return NextResponse.json({
        message: "Usuario creado correctamente",
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name,
          role: role || "employee",
          businessId: businessId || null,
        },
      })
    }

    return NextResponse.json({ error: "Error desconocido al crear usuario" }, { status: 500 })
  } catch (error) {
    console.error("Error al crear usuario:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 })
  }
}

