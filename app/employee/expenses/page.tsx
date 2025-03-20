"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getExpenses } from "@/lib/redux/slices/expensesSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { getEmployees } from "@/lib/redux/slices/employeeSlice"

export default function EmployeeExpensesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { expenses, loading: expensesLoading } = useSelector((state: RootState) => state.expenses)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)

  // Rest of the component...

  useEffect(() => {
    dispatch(getExpenses())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
    dispatch(getEmployees())
  }, [dispatch])

  // Rest of the component...
}

