import type { Metadata } from "next"
import ServerLogs from "@/components/admin/ServerLogs"

export const metadata: Metadata = {
  title: "Logs del Servidor | Panel de Administración",
  description: "Visualización de logs del servidor en tiempo real",
}

export default function LogsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Logs del Servidor</h1>
      <ServerLogs />
    </div>
  )
}

