"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getSales } from "@/lib/redux/slices/salesSlice"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { getEmployees } from "@/lib/redux/slices/employeeSlice"

export default function EmployeeAnalyticsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)

  // Rest of the component...

  useEffect(() => {
    dispatch(getSales())
    dispatch(getProducts())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
    dispatch(getEmployees())
  }, [dispatch])

  // Rest of the component...
}

