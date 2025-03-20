"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Actualizar el estado para que el siguiente renderizado muestre la UI alternativa
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Registrar el error en la consola
    console.error("Error capturado por ErrorBoundary:", error, errorInfo)

    // Opcionalmente, enviar el error a un servicio de monitoreo
    if (process.env.NODE_ENV === "production") {
      try {
        fetch("/api/log-error", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
            errorInfo: {
              componentStack: errorInfo.componentStack,
            },
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        }).catch((e) => console.error("Error enviando log de error:", e))
      } catch (e) {
        // Silenciar errores en el envío de logs
      }
    }
  }

  public render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError) {
      // Puedes renderizar cualquier UI personalizada
      return (
        fallback || (
          <div className="p-4 m-4 border border-red-500 rounded-md bg-red-50">
            <h2 className="text-xl font-bold text-red-700 mb-2">Algo salió mal</h2>
            <details className="whitespace-pre-wrap">
              <summary className="cursor-pointer text-red-600 font-medium">Ver detalles del error</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto text-sm">
                {error?.toString()}
                <br />
                {errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        )
      )
    }

    return children
  }
}

export default ErrorBoundary

