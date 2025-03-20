import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

// Cargar variables de entorno
dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// Crear cliente de Supabase con clave de servicio
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

// Función para crear usuario administrador
async function createAdminUser(email: string, password: string, name: string) {
  try {
    // Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "admin",
      },
    })

    if (authError) {
      console.error("Error al crear usuario en Auth:", authError.message)
      return
    }

    console.log("Usuario creado en Auth:", authData.user.id)

    // Crear entrada en la tabla users
    if (authData.user) {
      const { data: userData, error: dbError } = await supabaseAdmin
        .from("users")
        .insert({
          auth_id: authData.user.id,
          name,
          email,
          role: "admin",
        })
        .select()
        .single()

      if (dbError) {
        console.error("Error al crear usuario en la base de datos:", dbError.message)
        // Intentar eliminar el usuario de Auth si falla la inserción en la base de datos
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return
      }

      console.log("Usuario administrador creado correctamente:", userData)
    }
  } catch (error) {
    console.error("Error inesperado:", error)
  }
}

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2)
if (args.length < 3) {
  console.error("Uso: ts-node create-admin-user.ts <email> <password> <name>")
  process.exit(1)
}

const [email, password, name] = args

// Crear usuario administrador
createAdminUser(email, password, name)
  .then(() => {
    console.log("Proceso completado")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error en el proceso:", error)
    process.exit(1)
  })

