import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createModuleLogger } from "@/lib/serverLogger"
import type { Employee } from "@/lib/redux/slices/employeeSlice"

const logger = createModuleLogger("employeeService")

// Función para obtener todos los empleados
async function getAllEmployees() {
  try {
    const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false })

    if (error) {
      logger.error("Error fetching employees", { error: error.message })
      throw new Error(`Error fetching employees: ${error.message}`)
    }

    return data || []
  } catch (error) {
    logger.error("Unexpected error fetching employees", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para obtener empleados por negocio
async function getEmployeesByBusinessId(businessId: string) {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("Error fetching employees by business", { businessId, error: error.message })
      throw new Error(`Error fetching employees by business: ${error.message}`)
    }

    return data || []
  } catch (error) {
    logger.error("Unexpected error fetching employees by business", {
      businessId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para obtener todos los empleados con su turno actual
async function getAllEmployeesWithCurrentShift() {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        *,
        businesses (name),
        shifts (id, start_time)
      `,
      )
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("Error fetching employees with shifts", { error: error.message })
      throw new Error(`Error fetching employees with shifts: ${error.message}`)
    }

    // Transformar los datos para que coincidan con la interfaz Employee
    const employees = data?.map((employee) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      businessId: employee.business_id,
      businessName: employee.businesses?.name || "Desconocido",
      userId: employee.user_id,
      currentShift: employee.shifts
        ? {
            id: employee.shifts.id,
            startTime: employee.shifts.start_time,
          }
        : null,
    }))

    return employees || []
  } catch (error) {
    logger.error("Unexpected error fetching employees with shifts", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para crear un empleado
async function createEmployee(employee: {
  name: string
  email: string
  business_id: string
}) {
  try {
    const { data, error } = await supabase.from("employees").insert([employee]).select().single()

    if (error) {
      logger.error("Error creating employee", { employee, error: error.message })
      throw new Error(`Error creating employee: ${error.message}`)
    }

    return data
  } catch (error) {
    logger.error("Unexpected error creating employee", {
      employee,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para verificar si un usuario ya existe en el sistema de autenticación
async function checkUserExists(email: string) {
  try {
    // Buscar usuario por email en el sistema de autenticación
    logger.info("Checking if user exists in auth system", { email })

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      filter: {
        email: email,
      },
    })

    if (error) {
      logger.error("Error checking if user exists", { email, error: error.message })
      return null
    }

    // Registrar los usuarios encontrados para depuración
    logger.info("Auth users found", {
      email,
      usersCount: data.users?.length || 0,
      users: data.users?.map((u) => ({ id: u.id, email: u.email })),
    })

    // Si encontramos usuarios con ese email, devolver el primero
    if (data.users && data.users.length > 0) {
      const user = data.users[0]
      logger.info("User found in auth system", { userId: user.id, email: user.email })
      return user
    }

    logger.info("No user found in auth system", { email })
    return null
  } catch (error) {
    logger.error("Unexpected error checking if user exists", {
      email,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Función para verificar si un usuario ya existe en la tabla users
async function checkUserRecordExists(authId: string) {
  try {
    logger.info("Checking if user record exists in users table", { authId })

    const { data, error } = await supabaseAdmin.from("users").select("*").eq("auth_id", authId).single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 es el código para "no se encontraron resultados"
      logger.error("Error checking if user record exists", { authId, error: error.message })
      return null
    }

    if (data) {
      logger.info("User record found in users table", { userRecordId: data.id, authId, email: data.email })
    } else {
      logger.info("No user record found in users table", { authId })
    }

    return data
  } catch (error) {
    logger.error("Unexpected error checking if user record exists", {
      authId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Función para verificar si un auth_id ya existe en la tabla users
async function checkAuthIdExists(authId: string) {
  try {
    logger.info("Checking if auth_id exists in users table", { authId })

    // Verificar si el auth_id ya existe en la tabla users
    const { data, error } = await supabaseAdmin.from("users").select("id, email").eq("auth_id", authId).maybeSingle()

    if (error) {
      logger.error("Error checking if auth_id exists", { authId, error: error.message })
      // En caso de error, asumimos que el auth_id podría existir por precaución
      return true
    }

    if (data) {
      logger.info("Auth ID already exists in users table", { authId, userRecordId: data.id, email: data.email })
      return true
    }

    logger.info("Auth ID does not exist in users table", { authId })
    return false
  } catch (error) {
    logger.error("Unexpected error checking if auth_id exists", {
      authId,
      error: error instanceof Error ? error.message : String(error),
    })
    // En caso de error, asumimos que el auth_id podría existir por precaución
    return true
  }
}

// Función para verificar si un empleado ya existe
async function checkEmployeeExists(email: string) {
  try {
    logger.info("Checking if employee exists", { email })

    const { data, error } = await supabaseAdmin.from("employees").select("*").eq("email", email).single()

    console.log("data",data)
    console.log("errro",error)
    if (error && error.code !== "PGRST116") {
      // PGRST116 es el código para "no se encontraron resultados"
      logger.error("Error checking if employee exists", { email, error: error.message })
      return null
    }

    if (data) {
      logger.info("Employee found", { employeeId: data.id, email })
    } else {
      logger.info("No employee found", { email })
    }

    return data
  } catch (error) {
    logger.error("Unexpected error checking if employee exists", {
      email,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Función para obtener la estructura de la tabla employees
async function getEmployeeTableInfo() {
  try {
    // Esta consulta obtiene información sobre las restricciones de clave foránea
    const { data, error } = await supabaseAdmin.rpc("get_foreign_keys", { p_table_name: "employees" })

    if (error) {
      logger.error("Error getting employee table info", { error: error.message })
      return null
    }

    return data
  } catch (error) {
    logger.error("Unexpected error getting employee table info", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Función para obtener las columnas de la tabla employees
async function getEmployeeColumns() {
  try {
    // Esta consulta obtiene información sobre las columnas de la tabla
    const { data, error } = await supabaseAdmin.from("employees").select("*").limit(1)

    if (error) {
      logger.error("Error getting employee columns", { error: error.message })
      return null
    }

    // Si hay datos, devolver las claves del primer objeto (nombres de columnas)
    if (data && data.length > 0) {
      return Object.keys(data[0])
    }

    // Si no hay datos, intentar obtener la estructura de la tabla de otra manera
    const { data: schemaData, error: schemaError } = await supabaseAdmin.rpc("get_table_columns", {
      p_table_name: "employees",
    })

    if (schemaError) {
      logger.error("Error getting employee schema", { error: schemaError.message })
      return null
    }

    return schemaData
  } catch (error) {
    logger.error("Unexpected error getting employee columns", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Función para verificar si un correo electrónico ya está en uso
async function isEmailInUse(email: string) {
  try {
    logger.info("Checking if email is in use", { email })

    // Verificar primero en la tabla users
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, auth_id")
      .eq("email", email)
      .maybeSingle()

    if (userError) {
      logger.error("Error checking if email is in use in users table", { email, error: userError.message })
    } else if (userData) {
      logger.info("Email found in users table", { email, userId: userData.id, authId: userData.auth_id })
      return true
    }

    // Verificar en el sistema de autenticación
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
      page: 1,
    })

    if (error) {
      logger.error("Error checking if email is in use in auth system", { email, error: error.message })
      // En caso de error, asumimos que el correo podría estar en uso por precaución
      return true
    }

    // Filtrar manualmente por el correo exacto (case insensitive)
    const emailLowerCase = email.toLowerCase()
    const matchingUsers = data.users.filter((user) => user.email && user.email.toLowerCase() === emailLowerCase)

    // Registrar los usuarios encontrados para depuración
    logger.info("Auth users filtered for email check", {
      email,
      totalUsers: data.users.length,
      matchingUsersCount: matchingUsers.length,
      matchingUsers: matchingUsers.map((u) => ({ id: u.id, email: u.email })),
    })

    // Si hay usuarios con este email exacto, entonces está en uso
    if (matchingUsers.length > 0) {
      logger.info("Email is already in use in auth system", { email, matchingUsersCount: matchingUsers.length })
      return true
    }

    logger.info("Email is available", { email })
    return false
  } catch (error) {
    logger.error("Unexpected error checking if email is in use", {
      email,
      error: error instanceof Error ? error.message : String(error),
    })
    // En caso de error, asumimos que el correo podría estar en uso por precaución
    return true
  }
}

// Función para esperar a que un registro de usuario esté disponible y actualizarlo si es necesario
async function waitForUserRecord(
  authId: string,
  businessId: string,
  name: string,
  maxAttempts = 5,
  delayMs = 500,
): Promise<any> {
  logger.info("Waiting for user record to be available", { authId, businessId, maxAttempts, delayMs })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.info(`Attempt ${attempt} of ${maxAttempts} to find user record`, { authId })

    // Buscar el registro de usuario
    const { data: userRecord, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_id", authId)
      .maybeSingle()

    if (error) {
      logger.error("Error finding user record", { authId, error: error.message, attempt })
      // Continuar con el siguiente intento
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }

    if (userRecord) {
      logger.info("User record found", {
        authId,
        userRecordId: userRecord.id,
        currentBusinessId: userRecord.business_id,
        targetBusinessId: businessId,
        attempt,
      })

      // Verificar si necesita actualización
      if (userRecord.business_id !== businessId || userRecord.name !== name || userRecord.role !== "employee") {
        logger.info("User record needs update", {
          userRecordId: userRecord.id,
          currentBusinessId: userRecord.business_id,
          targetBusinessId: businessId,
        })

        // Actualizar el registro
        const { data: updatedRecord, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            business_id: businessId,
            name: name,
            role: "employee",
          })
          .eq("id", userRecord.id)
          .select()
          .single()

        if (updateError) {
          logger.error("Error updating user record", {
            userRecordId: userRecord.id,
            error: updateError.message,
          })
          return userRecord // Devolver el registro original si falla la actualización
        }

        logger.info("User record updated successfully", {
          userRecordId: updatedRecord.id,
          businessId: updatedRecord.business_id,
        })
        return updatedRecord
      }

      return userRecord
    }

    // Esperar antes del siguiente intento
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  logger.error("Failed to find user record after maximum attempts", { authId, maxAttempts })
  return null
}

// Nueva función para crear un empleado con autenticación adaptada al trigger
async function createEmployeeWithAuth(
  employee: {
    name: string
    email: string
    business_id: string
  },
  password: string,
) {
  try {
    logger.info("Starting createEmployeeWithAuth process", { email: employee.email })

    // Verificar si el empleado ya existe
    const existingEmployee = await checkEmployeeExists(employee.email)
    if (existingEmployee) {
      logger.info("Employee already exists", { email: employee.email, employeeId: existingEmployee.id })
      throw new Error(`Ya existe un empleado con el correo ${employee.email}`)
    }

    // Verificar si el correo ya está en uso
    const emailInUse = await isEmailInUse(employee.email)
    if (emailInUse) {
      logger.info("Email already in use", { email: employee.email })
      throw new Error(
        `El correo ${employee.email} ya está en uso. No se puede crear un nuevo empleado con este correo.`,
      )
    }

    // Crear nuevo usuario en el sistema de autenticación
    logger.info("Creating new user in auth system", { email: employee.email })
    let userId: string
    let userRecord: any

    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: employee.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: employee.name,
          role: "employee",
          businessId: employee.business_id,
        },
      })

      if (authError) {
        logger.error("Error creating auth user", { email: employee.email, error: authError.message })
        throw new Error(`Error creating auth user: ${authError.message}`)
      }

      if (!authData.user) {
        logger.error("No user returned from auth creation", { email: employee.email })
        throw new Error("No se pudo crear el usuario de autenticación")
      }

      userId = authData.user.id
      logger.info("Successfully created auth user", { userId, email: employee.email })

      // Esperar a que el trigger cree el registro en la tabla users y actualizarlo si es necesario
      logger.info("Waiting for trigger to create user record and updating business_id", {
        userId,
        businessId: employee.business_id,
      })
      userRecord = await waitForUserRecord(userId, employee.business_id, employee.name)

      if (!userRecord) {
        logger.error("User record not created by trigger", { userId, email: employee.email })

        // Intentar actualizar manualmente el registro si existe pero no tiene los datos correctos
        logger.info("Attempting to find and update user record manually", { userId })

        const { data: existingRecord, error: findError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("auth_id", userId)
          .maybeSingle()

        if (findError) {
          logger.error("Error finding user record", { userId, error: findError.message })
        } else if (existingRecord) {
          // El registro existe pero podría necesitar actualización
          logger.info("Found existing user record, updating", {
            userRecordId: existingRecord.id,
            userId,
          })

          const { data: updatedRecord, error: updateError } = await supabaseAdmin
            .from("users")
            .update({
              name: employee.name,
              email: employee.email,
              role: "employee",
              business_id: employee.business_id,
            })
            .eq("id", existingRecord.id)
            .select()
            .single()

          if (updateError) {
            logger.error("Error updating user record", {
              userRecordId: existingRecord.id,
              error: updateError.message,
            })
          } else {
            userRecord = updatedRecord
            logger.info("Successfully updated user record", {
              userRecordId: userRecord.id,
              userId,
            })
          }
        } else {
          // El registro no existe, intentar crearlo manualmente
          logger.info("User record not found, creating manually", { userId })

          const { data: newRecord, error: createError } = await supabaseAdmin
            .from("users")
            .insert([
              {
                auth_id: userId,
                name: employee.name,
                email: employee.email,
                role: "employee",
                business_id: employee.business_id,
              },
            ])
            .select()
            .single()

          if (createError) {
            logger.error("Error creating user record manually", { userId, error: createError.message })
            // Eliminar el usuario de autenticación si falla la creación del registro en users
            logger.info("Attempting to delete auth user after manual user record creation failure", { userId })
            await supabaseAdmin.auth.admin.deleteUser(userId)
            throw new Error(`Error creating user record manually: ${createError.message}`)
          }

          userRecord = newRecord
          logger.info("Successfully created user record manually", {
            userRecordId: userRecord.id,
            userId,
          })
        }
      }

      if (!userRecord) {
        logger.error("Failed to get or create user record", { userId, email: employee.email })
        // Eliminar el usuario de autenticación si no se puede obtener o crear el registro en users
        logger.info("Attempting to delete auth user due to missing user record", { userId })
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw new Error("No se pudo obtener o crear el registro de usuario")
      }
    } catch (authCreateError) {
      logger.error("Exception during auth user creation or record retrieval", {
        email: employee.email,
        error: authCreateError instanceof Error ? authCreateError.message : String(authCreateError),
      })
      throw authCreateError
    }

    // Crear empleado con referencia al usuario
    logger.info("Creating employee record", {
      userRecordId: userRecord.id,
      email: employee.email,
      businessId: employee.business_id,
    })

    try {
      const { data: employeeData, error: employeeError } = await supabaseAdmin
        .from("employees")
        .insert([
          {
            name: employee.name,
            email: employee.email,
            business_id: employee.business_id,
            user_id: userRecord.id,
          },
        ])
        .select()
        .single()

      if (employeeError) {
        logger.error("Error creating employee record", {
          userId,
          userRecordId: userRecord?.id,
          error: employeeError.message,
        })
        // No eliminamos el usuario porque podría ser utilizado por otros procesos
        throw new Error(`Error creating employee record: ${employeeError.message}`)
      }

      logger.info("Successfully created employee with auth", {
        employeeId: employeeData.id,
        userId: userId,
        userRecordId: userRecord.id,
        email: employee.email,
        businessId: employee.business_id,
      })

      return employeeData
    } catch (employeeCreateError) {
      logger.error("Exception during employee record creation", {
        userRecordId: userRecord.id,
        error: employeeCreateError instanceof Error ? employeeCreateError.message : String(employeeCreateError),
      })
      throw employeeCreateError
    }
  } catch (error) {
    logger.error("Unexpected error creating employee with auth", {
      email: employee.email,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para limpiar usuarios huérfanos
async function cleanupOrphanedUsers() {
  try {
    logger.info("Starting cleanup of orphaned users")

    // Obtener todos los usuarios de la tabla users
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email")
      .is("deleted_at", null)

    if (usersError) {
      logger.error("Error fetching users for cleanup", { error: usersError.message })
      return { success: false, error: usersError.message }
    }

    if (!usersData || usersData.length === 0) {
      logger.info("No users found for cleanup")
      return { success: true, cleaned: 0 }
    }

    logger.info("Found users for potential cleanup", { count: usersData.length })

    let cleanedCount = 0

    // Para cada usuario, verificar si tiene un empleado asociado
    for (const user of usersData) {
      // Verificar si el usuario tiene un empleado asociado
      const { data: employeeData, error: employeeError } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (employeeError && employeeError.code !== "PGRST116") {
        logger.error("Error checking if user has associated employee", {
          userId: user.id,
          error: employeeError.message,
        })
        continue
      }

      // Si no hay empleado asociado, marcar el usuario como eliminado
      if (!employeeData) {
        logger.info("Found orphaned user without associated employee", {
          userId: user.id,
          email: user.email,
          authId: user.auth_id,
        })

        // Marcar como eliminado en lugar de eliminar físicamente
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", user.id)

        if (updateError) {
          logger.error("Error marking orphaned user as deleted", {
            userId: user.id,
            error: updateError.message,
          })
        } else {
          logger.info("Successfully marked orphaned user as deleted", { userId: user.id })
          cleanedCount++
        }
      }
    }

    logger.info("Completed cleanup of orphaned users", { cleanedCount })
    return { success: true, cleaned: cleanedCount }
  } catch (error) {
    logger.error("Unexpected error during cleanup of orphaned users", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: String(error) }
  }
}

// Función para actualizar un empleado
async function updateEmployee(employee: Employee) {
  try {
    const { data, error } = await supabase
      .from("employees")
      .update({
        name: employee.name,
        email: employee.email,
        business_id: employee.businessId,
        // No actualizamos user_id aquí para evitar romper la relación
      })
      .eq("id", employee.id)
      .select()
      .single()

    if (error) {
      logger.error("Error updating employee", { employeeId: employee.id, error: error.message })
      throw new Error(`Error updating employee: ${error.message}`)
    }

    return data
  } catch (error) {
    logger.error("Unexpected error updating employee", {
      employeeId: employee.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Función para eliminar un empleado
async function deleteEmployee(id: string) {
  try {
    // Primero obtenemos el empleado para saber su user_id
    const { data: employee, error: fetchError } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", id)
      .single()

    if (fetchError) {
      logger.error("Error fetching employee for deletion", { employeeId: id, error: fetchError.message })
      throw new Error(`Error fetching employee for deletion: ${fetchError.message}`)
    }

    // Eliminamos el empleado
    const { error } = await supabase.from("employees").delete().eq("id", id)

    if (error) {
      logger.error("Error deleting employee", { employeeId: id, error: error.message })
      throw new Error(`Error deleting employee: ${error.message}`)
    }

    // Si hay un user_id asociado, también eliminamos el usuario
    if (employee?.user_id) {
      // Primero obtenemos el registro de usuario para saber su auth_id
      const { data: userRecord, error: userFetchError } = await supabaseAdmin
        .from("users")
        .select("auth_id")
        .eq("id", employee.user_id)
        .single()

      if (userFetchError) {
        logger.error("Error fetching user record for deletion", {
          userId: employee.user_id,
          error: userFetchError.message,
        })
        // No lanzamos error aquí para no interrumpir el flujo si ya se eliminó el empleado
      } else if (userRecord) {
        // Eliminamos de la tabla users
        const { error: userError } = await supabaseAdmin.from("users").delete().eq("id", employee.user_id)

        if (userError) {
          logger.error("Error deleting user record", { userId: employee.user_id, error: userError.message })
          // No lanzamos error aquí para no interrumpir el flujo si ya se eliminó el empleado
        }

        // Eliminamos de auth si tenemos el auth_id
        if (userRecord.auth_id) {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userRecord.auth_id)

          if (authError) {
            logger.error("Error deleting auth user", { authId: userRecord.auth_id, error: authError.message })
            // No lanzamos error aquí para no interrumpir el flujo si ya se eliminó el empleado
          }
        }
      }
    }

    return { success: true }
  } catch (error) {
    logger.error("Unexpected error deleting employee", {
      employeeId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Exportar todas las funciones
export const employeeService = {
  getAll: getAllEmployees,
  getByBusinessId: getEmployeesByBusinessId,
  getAllWithCurrentShift: getAllEmployeesWithCurrentShift,
  create: createEmployee,
  createWithAuth: createEmployeeWithAuth,
  update: updateEmployee,
  delete: deleteEmployee,
  cleanupOrphanedUsers: cleanupOrphanedUsers,
}

