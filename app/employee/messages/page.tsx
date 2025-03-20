"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses

export default function EmployeeMessagesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  // Rest of the component...

  useEffect(() => {
    dispatch(getEmployees())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
  }, [dispatch])

  // Rest of the component...
}

