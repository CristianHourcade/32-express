type LogLevel = "info" | "warn" | "error" | "debug"

interface LogOptions {
  module?: string
  context?: Record<string, any>
  timestamp?: boolean
}

/**
 * Función para registrar mensajes en el cliente
 */
export function clientLog(message: string, level: LogLevel = "info", options: LogOptions = {}) {
  const { module = "client", context = {}, timestamp = true } = options

  // Solo mostrar logs de debug en desarrollo
  if (level === "debug" && process.env.NODE_ENV === "production") {
    return
  }

  const time = timestamp ? new Date().toISOString() : ""
  const prefix = `[${time}] [${level.toUpperCase()}] [${module}]`

  // Formatear el mensaje con colores según el nivel
  const formattedMessage = `${prefix} ${message}`

  // Añadir contexto si existe
  const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : ""

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

  // Opcionalmente, enviar logs al servidor para almacenamiento persistente
  if (process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGGING === "true") {
    try {
      fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level,
          message,
          module,
          context,
          timestamp: time,
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch((e) => console.error("Error enviando log al servidor:", e))
    } catch (e) {
      // Silenciar errores en el envío de logs para no afectar la aplicación
    }
  }
}

// Funciones de conveniencia para diferentes niveles de log
export const logInfo = (message: string, options?: LogOptions) => clientLog(message, "info", options)

export const logWarn = (message: string, options?: LogOptions) => clientLog(message, "warn", options)

export const logError = (message: string, options?: LogOptions) => clientLog(message, "error", options)

export const logDebug = (message: string, options?: LogOptions) => clientLog(message, "debug", options)

// Función para crear un logger específico para un módulo
export function createModuleLogger(moduleName: string) {
  return {
    info: (message: string, context?: Record<string, any>) => logInfo(message, { module: moduleName, context }),
    warn: (message: string, context?: Record<string, any>) => logWarn(message, { module: moduleName, context }),
    error: (message: string, context?: Record<string, any>) => logError(message, { module: moduleName, context }),
    debug: (message: string, context?: Record<string, any>) => logDebug(message, { module: moduleName, context }),
  }
}

