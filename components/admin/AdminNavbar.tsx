"use client"

import React, { useState, useEffect, useRef } from "react"
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
  DollarSign,
  X,
  Menu,
  LogOut,
  LucideTags,
  Archive,
  Tag,
  ArchiveRestoreIcon,
  Building2,
  Command,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navSections = [
  {
    title: "Insights",
    items: [
      { name: "Dashboard",    href: "/admin/dashboard",   icon: Gauge },
      { name: "Estadísticas", href: "/admin/estadistica", icon: ChartIcon },
      { name: "Actividad",    href: "/admin/actividad",   icon: Activity },
      { name: "Categorías",   href: "/admin/stock",       icon: LucideTags },
      { name: "Inventario",   href: "/admin/inventario",  icon: ArchiveRestoreIcon },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { name: "Productos", href: "/admin/products", icon: Tag },
      { name: "Comando",   href: "/admin/alertas",  icon: Command },
      { name: "Promos",    href: "/admin/promos",   icon: Archive },
    ],
  },
  {
    title: "Gestión",
    items: [
      { name: "Turnos", href: "/admin/turnos", icon: Clock },
      { name: "Gastos", href: "/admin/gastos", icon: DollarSign },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { name: "Negocios", href: "/admin/business", icon: Building2 },
    ],
  },
]

/* ── Tooltip para el sidebar colapsado ── */
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                      opacity-0 group-hover/tip:opacity-100 transition-opacity delay-100 duration-150">
        <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900
                        text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent
                          border-r-slate-900 dark:border-r-slate-100" />
        </div>
      </div>
    </div>
  )
}

export default function AdminNavbar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const dispatch  = useDispatch<AppDispatch>()
  const { user }  = useSelector((state: RootState) => state.auth)

  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [expanded,     setExpanded]     = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await dispatch(logout())
    router.push("/login")
  }

  // Cerrar mobile al navegar
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Colapsar sidebar al hacer click fuera en desktop
  useEffect(() => {
    if (!expanded) return
    function handler(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [expanded])

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "??"

  return (
    <>
      {/* ══════════════════════════════════════
          MOBILE HEADER
      ══════════════════════════════════════ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14
                      bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
                      border-b border-slate-200 dark:border-slate-800
                      flex items-center justify-between px-4">
        <span className="text-base font-bold tracking-tight text-sky-600 dark:text-sky-400 select-none">
          32 EXPRESS
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menú"
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800
                       transition-colors active:scale-95"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════
          MOBILE DRAWER
      ══════════════════════════════════════ */}
      <div className={cn(
        "md:hidden fixed inset-0 z-30 transition-all duration-300",
        mobileOpen ? "visible" : "invisible pointer-events-none"
      )}>
        {/* Overlay */}
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Sheet */}
        <div className={cn(
          "absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900",
          "border-r border-slate-200 dark:border-slate-800",
          "flex flex-col pt-14 transition-transform duration-300 ease-out shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* User badge */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50
                            flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {user?.name ?? "Usuario"}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email ?? ""}</p>
            </div>
            <div className="ml-auto"><ThemeToggle /></div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest
                               text-slate-400 dark:text-slate-500">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                            isActive
                              ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                          )}
                        >
                          <item.icon className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            isActive ? "text-sky-500" : "text-slate-400"
                          )} />
                          {item.name}
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                         text-red-500 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-900/20
                         transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          DESKTOP SIDEBAR
          Colapsado = 64px | Expandido = 200px
      ══════════════════════════════════════ */}
      <div
        ref={sidebarRef}
        className={cn(
          "hidden md:flex flex-col fixed inset-y-0 left-0 z-30",
          "bg-white dark:bg-slate-900",
          "border-r border-slate-200 dark:border-slate-800",
          "transition-all duration-200 ease-out",
          expanded ? "w-52" : "w-16"
        )}
      >
        {/* Logo / toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-14 flex items-center justify-center gap-2 shrink-0
                     hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          aria-label={expanded ? "Colapsar menú" : "Expandir menú"}
        >
          <span className="text-base font-black tracking-tighter text-sky-600 dark:text-sky-400 select-none">
            32
          </span>
          {expanded && (
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
              EXPRESS
            </span>
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4">
          {navSections.map((section, idx) => (
            <React.Fragment key={section.title}>
              <div>
                {expanded && (
                  <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest
                                text-slate-400 dark:text-slate-600 truncate">
                    {section.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    const inner = (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "relative flex items-center rounded-xl transition-all duration-150",
                          "h-10 gap-3",
                          expanded ? "px-3" : "justify-center",
                          isActive
                            ? "bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        {/* Indicador activo */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2
                                           h-5 w-0.5 rounded-r-full bg-sky-500" />
                        )}
                        <item.icon className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-sky-500" : ""
                        )} />
                        {expanded && (
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        )}
                      </Link>
                    )
                    return (
                      <li key={item.name}>
                        {expanded ? inner : (
                          <NavTooltip label={item.name}>{inner}</NavTooltip>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
              {idx < navSections.length - 1 && (
                <div className={cn(
                  "border-t border-slate-100 dark:border-slate-800",
                  expanded ? "mx-2" : "mx-3"
                )} />
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          "shrink-0 border-t border-slate-100 dark:border-slate-800 px-2 py-2 space-y-1"
        )}>
          {/* Theme toggle */}
          <div className={cn(
            "flex items-center h-10 rounded-xl px-2",
            expanded ? "gap-3" : "justify-center"
          )}>
            <ThemeToggle />
            {expanded && (
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate">Tema</span>
            )}
          </div>

          {/* User */}
          {expanded ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl
                            bg-slate-50 dark:bg-slate-800/60">
              <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/50
                              flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{initials}</span>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                {user?.name ?? "Usuario"}
              </p>
            </div>
          ) : (
            <NavTooltip label={user?.name ?? "Usuario"}>
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/50
                                flex items-center justify-center cursor-default">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{initials}</span>
                </div>
              </div>
            </NavTooltip>
          )}

          {/* Logout */}
          {expanded ? (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-xs font-medium
                         text-red-500 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-900/20
                         transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {isLoggingOut ? "Cerrando…" : "Cerrar sesión"}
            </button>
          ) : (
            <NavTooltip label="Cerrar sesión">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex justify-center items-center h-9 rounded-xl
                           text-red-500 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20
                           transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </NavTooltip>
          )}
        </div>
      </div>

      {/* Spacer para que el contenido no quede debajo del sidebar */}
      <div className="hidden md:block md:w-16 shrink-0" />
    </>
  )
}