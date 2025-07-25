"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { logout } from "@/lib/redux/slices/authSlice"
import ThemeToggle from "@/components/ThemeToggle"
import {
  Gauge,
  BarChart2 as ChartIcon,
  Activity,
  Clock,
  Save,
  AlertTriangle,
  Box,
  Tag,
  CalendarDays,
  Users,
  Building2,
  DollarSign,
  X,
  Menu,
  LogOut,
  TagIcon,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Separar navItems en secciones
const navSections = [
  {
    title: "Insights",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: Gauge },
      { name: "Estadísticas", href: "/admin/estadistica", icon: ChartIcon },
      { name: "Actividad", href: "/admin/actividad", icon: Activity },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { name: "Faltantes", href: "/admin/faltantes", icon: AlertTriangle },
      { name: "Calendario", href: "/admin/provedores", icon: CalendarDays },
      { name: "Productos", href: "/admin/products", icon: Tag },
      { name: "Promo", href: "/admin/promos", icon: Archive },
    ],
  },
  {
    title: "Gestión",
    items: [
      { name: "Turnos", href: "/admin/turnos", icon: Clock },
      { name: "Empleados", href: "/admin/employees", icon: Users },
      { name: "Gastos", href: "/admin/gastos", icon: DollarSign },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { name: "Negocios", href: "/admin/business", icon: Building2 },
      { name: "Reservas", href: "/admin/savings", icon: Save },
    ],
  },
]

export default function AdminNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await dispatch(logout())
    router.push("/login")
  }

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 z-40 w-full bg-white dark:bg-slate-900 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500">32 EXPRESS</h1>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-white dark:bg-slate-900 pt-16 overflow-y-auto">
          <nav className="px-4 py-2">
            {navSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="px-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {section.title}
                </p>
                <ul className="mt-1 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center p-3 rounded-md",
                            isActive
                              ? "bg-sky-100 text-sky-600 dark:bg-sky-800 dark:text-sky-300"
                              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className="w-5 h-5 mr-3" />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center p-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md"
            >
              <LogOut className="w-5 h-5 mr-3" />
              {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-20 md:flex-col md:fixed md:inset-y-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo */}
          <div className="flex items-center justify-center h-16">
            <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">32</h1>
          </div>

          {/* Nav Sections */}
          <nav className="flex-1 flex flex-col items-center mt-4">
            {navSections.map((section, idx) => (
              <React.Fragment key={section.title}>
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={item.name}
                      className={cn(
                        "relative group flex items-center justify-center w-12 h-12 mb-2 rounded-xl transition-all transform hover:scale-105",
                        isActive
                          ? "bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300"
                          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-sky-500" />
                      )}
                      <item.icon className="w-5 h-5" />
                    </Link>
                  )
                })}
                {/* separar secciones con un divider */}
                {idx < navSections.length - 1 && (
                  <hr className="w-8 border-slate-200 dark:border-slate-800 my-2" />
                )}
              </React.Fragment>
            ))}

            {/* Logout */}
            <div className="mt-auto mb-4">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Cerrar sesión"
                className="w-12 h-12 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
