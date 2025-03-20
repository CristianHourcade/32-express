import { type NextRequest, NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"
import { employeeService } from "@/services/admin/employeeService"

const logger = createModuleLogger("adminEmployeeByIdAPI")

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const employee = await employeeService.getEmployeeById(id)
    return NextResponse.json(employee)
  } catch (error) {
    logger.error("Error al obtener empleado", {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al obtener empleado: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const employeeData = await request.json()

    const updatedEmployee = await employeeService.updateEmployee(id, employeeData)
    return NextResponse.json(updatedEmployee)
  } catch (error) {
    logger.error("Error al actualizar empleado", {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al actualizar empleado: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    await employeeService.deleteEmployee(id)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    logger.error("Error al eliminar empleado", {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Error al eliminar empleado: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

