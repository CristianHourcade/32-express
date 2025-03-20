import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("createEmployeeUserAPI")

export async function POST(request: Request) {
  try {
    // Get request data - ONLY read the request body ONCE
    const requestData = await request.json()
    const { email, password, name, businessId } = requestData

    if (!email || !password || !name) {
      logger.error("Missing required fields", {
        hasEmail: !!email,
        hasPassword: !!password,
        hasName: !!name,
      })
      return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 })
    }

    logger.info("Creating employee user", { email })

    // Create a Supabase client with the service role key
    const supabase = createRouteHandlerClient({ cookies })

    // Create the user with the admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "employee",
        businessId,
      },
    })

    if (error) {
      logger.error("Error creating user", { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.user) {
      logger.error("No user returned from createUser")
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // Create entry in users table
    const { error: dbError } = await supabase.from("users").insert({
      auth_id: data.user.id,
      name,
      email,
      role: "employee",
      business_id: businessId || null,
    })

    if (dbError) {
      logger.error("Error inserting user in database", { error: dbError.message })
      // We don't return an error here because the auth user was created successfully
    }

    logger.info("User created successfully", {
      userId: data.user.id.substring(0, 8) + "...",
    })

    return NextResponse.json({
      userId: data.user.id,
      email: data.user.email,
    })
  } catch (error) {
    logger.error("Unexpected error in create-employee-user", {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

