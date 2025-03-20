import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import {
  fetchActivities,
  fetchActivitiesByBusiness,
  fetchActivitiesByUser,
} from "@/services/factory/activityServiceFactory"

export interface Activity {
  id: string
  userId: string
  userName: string
  userRole: string
  businessId: string
  businessName: string
  action: string
  details: string
  timestamp: string
}

interface ActivityState {
  activities: Activity[]
  loading: boolean
  error: string | null
}

const initialState: ActivityState = {
  activities: [],
  loading: false,
  error: null,
}

export const getActivities = createAsyncThunk("activity/getActivities", async () => {
  console.log("Dispatching getActivities thunk")
  const response = await fetchActivities()
  return response
})

// Añadir alias para mantener compatibilidad con código existente
export const getActivity = getActivities

export const getActivitiesByBusiness = createAsyncThunk(
  "activity/getActivitiesByBusiness",
  async (businessId: string) => {
    console.log(`Dispatching getActivitiesByBusiness thunk for business: ${businessId}`)
    const response = await fetchActivitiesByBusiness(businessId)
    return response
  },
)

export const getActivitiesByUser = createAsyncThunk("activity/getActivitiesByUser", async (userId: string) => {
  console.log(`Dispatching getActivitiesByUser thunk for user: ${userId}`)
  const response = await fetchActivitiesByUser(userId)
  return response
})

const activitySlice = createSlice({
  name: "activity",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getActivities.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getActivities.fulfilled, (state, action: PayloadAction<Activity[]>) => {
        state.loading = false
        state.activities = action.payload
      })
      .addCase(getActivities.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch activities"
      })
      .addCase(getActivitiesByBusiness.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getActivitiesByBusiness.fulfilled, (state, action: PayloadAction<Activity[]>) => {
        state.loading = false
        state.activities = action.payload
      })
      .addCase(getActivitiesByBusiness.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch activities by business"
      })
      .addCase(getActivitiesByUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getActivitiesByUser.fulfilled, (state, action: PayloadAction<Activity[]>) => {
        state.loading = false
        state.activities = action.payload
      })
      .addCase(getActivitiesByUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch activities by user"
      })
  },
})

export default activitySlice.reducer

