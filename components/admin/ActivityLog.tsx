"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { fetchActivities } from "@/lib/redux/slices/activitySlice" // Changed from getActivity if it was used here
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export default function ActivityLog() {
  const dispatch = useDispatch<AppDispatch>()
  const { activities, loading } = useSelector((state: RootState) => state.activity)

  useEffect(() => {
    dispatch(fetchActivities()) // Changed from getActivity if it was used here
  }, [dispatch])

  // Ordenar actividades por fecha (más recientes primero)
  const sortedActivities = [...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10) // Mostrar solo las 10 más recientes

  if (loading) {
    return <div className="animate-pulse">Cargando actividades...</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Actividad Reciente</h3>
      {sortedActivities.length === 0 ? (
        <p className="text-slate-500">No hay actividades recientes.</p>
      ) : (
        <div className="space-y-2">
          {sortedActivities.map((activity) => (
            <div key={activity.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <div className="flex justify-between">
                <span className="font-medium">{activity.userName}</span>
                <span className="text-sm text-slate-500">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                {activity.action}: {activity.details}
              </p>
              <p className="text-sm text-slate-500">{activity.businessName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

