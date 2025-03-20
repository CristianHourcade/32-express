"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warn" | "error" | "debug"
  module: string
  message: string
  details?: Record<string, any>
}

export default function ServerLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeTab, setActiveTab] = useState<string>("all")
  const [isPolling, setIsPolling] = useState<boolean>(true)

  // Función para obtener los logs del servidor
  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/admin/logs")
      if (!response.ok) throw new Error("Error al obtener logs")

      const data = await response.json()
      setLogs(data.logs)
    } catch (error) {
      console.error("Error al obtener logs:", error)
    }
  }

  // Efecto para iniciar el polling de logs
  useEffect(() => {
    if (isPolling) {
      fetchLogs()
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [isPolling])

  // Filtrar logs según la pestaña activa
  const filteredLogs = activeTab === "all" ? logs : logs.filter((log) => log.level === activeTab)

  // Función para obtener el color de la insignia según el nivel
  const getBadgeVariant = (level: string) => {
    switch (level) {
      case "error":
        return "destructive"
      case "warn":
        return "warning"
      case "info":
        return "default"
      case "debug":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Logs del Servidor</CardTitle>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsPolling(!isPolling)}>
            {isPolling ? "Pausar" : "Reanudar"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            Limpiar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="warn">Advertencias</TabsTrigger>
            <TabsTrigger value="error">Errores</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab}>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {filteredLogs.length > 0 ? (
                <div className="space-y-4">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="border-b pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getBadgeVariant(log.level)}>{log.level.toUpperCase()}</Badge>
                          <span className="text-sm font-medium">{log.module}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                      {log.details && (
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No hay logs disponibles</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

