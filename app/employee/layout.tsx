import type React from "react"
import EmployeeNavbar from "@/components/employee/EmployeeNavbar"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="employee">
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <EmployeeNavbar />
        <div className="md:pl-64 flex flex-col">
          <main className="flex-1">
            {/* Aumentamos significativamente el padding superior */}
            <div className="pt-20 md:pt-6 px-4 md:px-8">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

