import type { Activity } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface RecentActivityProps {
  activities: Activity[]
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400 text-center py-4">No hay actividades recientes.</p>
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-700 last:border-0"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityIconClass(
              activity.action,
            )}`}
          >
            {getActivityIcon(activity.action)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{activity.userName}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{activity.details}</p>
            <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Función para obtener la clase del icono según la acción
function getActivityIconClass(action: string): string {
  switch (action.toLowerCase()) {
    case "login":
      return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
    case "logout":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    case "new sale":
      return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
    case "add product":
    case "add expense":
      return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
    case "delete product":
    case "delete expense":
      return "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
    case "start shift":
      return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
    case "end shift":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    default:
      return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
  }
}

// Función para obtener el icono según la acción
function getActivityIcon(action: string): string {
  switch (action.toLowerCase()) {
    case "login":
      return "→"
    case "logout":
      return "←"
    case "new sale":
      return "$"
    case "add product":
      return "+"
    case "delete product":
      return "−"
    case "add expense":
      return "+"
    case "delete expense":
      return "−"
    case "start shift":
      return "▶"
    case "end shift":
      return "■"
    default:
      return "•"
  }
}

