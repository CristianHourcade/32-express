import { configureStore } from "@reduxjs/toolkit"
import businessReducer from "./slices/businessSlice"
import productReducer from "./slices/productSlice"
import employeeReducer from "./slices/employeeSlice"
import salesReducer from "./slices/salesSlice"
import expensesReducer from "./slices/expensesSlice"
import shiftReducer from "./slices/shiftSlice"
import activityReducer from "./slices/activitySlice"
import authReducer from "./slices/authSlice"

export const store = configureStore({
  reducer: {
    businesses: businessReducer, // Make sure this matches the state name used in selectors
    products: productReducer,
    employees: employeeReducer,
    sales: salesReducer,
    expenses: expensesReducer,
    shifts: shiftReducer,
    activity: activityReducer,
    auth: authReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

