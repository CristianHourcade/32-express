import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: { message: "Email is required" } }, { status: 400 })
    }

    const supabase = createClient()

    // Buscar usuario por email
    const { data, error } = await supabase.auth.admin.listUsers({
      filter: {
        email: email,
      },
    })

    if (error) {
      console.error("Error finding user by email:", error)
      return NextResponse.json({ error: { message: error.message } }, { status: 500 })
    }

    // Verificar si se encontró el usuario
    if (!data.users || data.users.length === 0) {
      return NextResponse.json({ data: null }, { status: 200 })
    }

    // Devolver el primer usuario encontrado
    return NextResponse.json({ data: { id: data.users[0].id, email: data.users[0].email } }, { status: 200 })
  } catch (error) {
    console.error("Unexpected error in find-user-by-email:", error)
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 },
    )
  }
}

