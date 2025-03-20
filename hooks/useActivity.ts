"use client"

import { useDispatch } from "react-redux"
import { addActivity } from "@/lib/redux/slices/activitySlice"
import { useAuth } from "./useAuth"
import { useBusinesses } from "./useBusinesses"
import type { AppDispatch } from "@/lib/redux/store"
import type { Activity } from "@/types"

export function useActivity() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useAuth()
  const { selectedBusiness } = useBusinesses()

  const logActivity = async (action: string, details: string) => {
    if (!user) return

    const activityData: Omit<Activity, "id" | "timestamp"> = {
      userId: user.id,
      userName: user.name || user.email,
      userRole: user.role || "employee", // Asegurar que siempre haya un rol
      businessId: selectedBusiness?.id || "",
      businessName: selectedBusiness?.name || "Sistema",
      action,
      details,
    }

    dispatch(addActivity(activityData))
  }

  return { logActivity }
}

