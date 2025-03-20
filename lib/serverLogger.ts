type LogLevel = "info" | "warn" | "error" | "debug"

interface LogOptions {
  module?: string
  context?: Record<string, any>
  timestamp?: boolean
}

/**
 * Función para registrar mensajes en el servidor
 */
export function serverLog(message: string, level: LogLevel = "info", options: LogOptions = {}) {
  const { module = "server", context = {}, timestamp = true } = options

  // Solo mostrar logs de debug en desarrollo
  if (level === "debug" && process.env.NODE_ENV === "production") {
    return
  }

  const time = timestamp ? new Date().toISOString() : ""
  const prefix = `[${time}] [${level.toUpperCase()}] [${module}]`

  // Formatear el mensaje con colores según el nivel
  const formattedMessage = `${prefix} ${message}`

  // Añadir contexto si existe
  const contextStr = Object.keys(context).length > 0 ? `\n${JSON.stringify(context, null, 2)}` : ""

  // Registrar según el nivel
  switch (level) {
    case "info":
      console.log(formattedMessage, contextStr)
      break
    case "warn":
      console.warn(formattedMessage, contextStr)
      break
    case "error":
      console.error(formattedMessage, contextStr)
      break
    case "debug":
      console.debug(formattedMessage, contextStr)
      break
  }
}

// Funciones de conveniencia para diferentes niveles de log
export const logInfo = (message: string, options?: LogOptions) => serverLog(message, "info", options)

export const logWarn = (message: string, options?: LogOptions) => serverLog(message, "warn", options)

export const logError = (message: string, options?: LogOptions) => serverLog(message, "error", options)

export const logDebug = (message: string, options?: LogOptions) => serverLog(message, "debug", options)

// Función para crear un logger específico para un módulo
export function createModuleLogger(moduleName: string) {
  return {
    info: (message: string, context?: Record<string, any>) => logInfo(message, { module: moduleName, context }),
    warn: (message: string, context?: Record<string, any>) => logWarn(message, { module: moduleName, context }),
    error: (message: string, context?: Record<string, any>) => logError(message, { module: moduleName, context }),
    debug: (message: string, context?: Record<string, any>) => logDebug(message, { module: moduleName, context }),
  }
}

