import { type NextRequest, NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"
import { employeeService } from "@/services/admin/employeeService"

const logger = createModuleLogger("adminEmployeesAPI")

export async function GET() {
  try {
    const employees = await employeeService.getAllEmployees()
    return NextResponse.json(employees)
  } catch (error) {
    logger.error("Error al obtener empleados", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al obtener empleados: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const employeeData = await request.json()

    // Validar datos mínimos requeridos
    if (!employeeData.name || !employeeData.email || !employeeData.business_id) {
      return NextResponse.json({ error: "Nombre, email y business_id son requeridos" }, { status: 400 })
    }

    const newEmployee = await employeeService.addEmployee(employeeData)
    return NextResponse.json(newEmployee, { status: 201 })
  } catch (error) {
    logger.error("Error al crear empleado", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al crear empleado: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

