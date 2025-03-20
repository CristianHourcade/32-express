"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { getSales } from "@/lib/redux/slices/salesSlice"

export default function EmployeeCustomersPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)

  // Rest of the component...

  useEffect(() => {
    dispatch(getEmployees())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
    dispatch(getSales())
  }, [dispatch])

  // Rest of the component...
}

