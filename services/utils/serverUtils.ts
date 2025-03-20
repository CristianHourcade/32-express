import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("serverUtils")

/**
 * Función para manejar errores en los servicios del servidor
 * @param error Error a manejar
 * @param context Contexto adicional para el log
 * @returns Objeto con mensaje de error formateado
 */
export function handleServerError(error: unknown, context: Record<string, any> = {}) {
  if (error instanceof Error) {
    logger.error(`Error en el servidor: ${error.message}`, {
      ...context,
      stack: error.stack,
    })
    return { error: error.message }
  }

  logger.error("Error desconocido en el servidor", { ...context, error })
  return { error: "Error interno del servidor" }
}

/**
 * Función para registrar actividad del servidor
 * @param action Acción realizada
 * @param details Detalles de la acción
 * @param userId ID del usuario que realizó la acción (opcional)
 */
export function logServerActivity(action: string, details: Record<string, any> = {}, userId?: string) {
  logger.info(`Actividad: ${action}`, {
    ...details,
    userId,
    timestamp: new Date().toISOString(),
  })

  // Aquí se podría implementar lógica para guardar la actividad en la base de datos
}

/**
 * Función para medir el tiempo de ejecución de una operación del servidor
 * @param operationName Nombre de la operación
 * @param operation Función a ejecutar
 * @returns Resultado de la operación
 */
export async function measureServerOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
  const startTime = performance.now()
  try {
    const result = await operation()
    const endTime = performance.now()
    logger.debug(`Operación "${operationName}" completada en ${(endTime - startTime).toFixed(2)}ms`)
    return result
  } catch (error) {
    const endTime = performance.now()
    logger.error(`Error en operación "${operationName}" después de ${(endTime - startTime).toFixed(2)}ms`, { error })
    throw error
  }
}

