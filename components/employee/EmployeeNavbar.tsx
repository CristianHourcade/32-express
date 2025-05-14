"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { logout } from "@/lib/redux/slices/authSlice";
import ThemeToggle from "@/components/ThemeToggle";
import {
  BarChart,
  Package,
  Menu,
  X,
  LogOut,
  UserIcon,
  PlusCircle,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* --- ítems base (sin Stock) --- */
const baseItems = [
  { name: "Dashboard", href: "/employee/dashboard", icon: BarChart },
  { name: "Productos", href: "/employee/products", icon: Package },
  { name: "Nueva Venta", href: "/employee/new-sale", icon: PlusCircle },
];

/* --- ítem Solo Supervisor --- */
const stockItem = { name: "Stock", href: "/employee/stock", icon: Save };

export default function EmployeeNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  /* ========= supervisor flag ========= */
  const [isSupervisor, setIsSupervisor] = useState(false);
  useEffect(() => {
    const fetchFlag = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("employees")
        .select("supervisor")
        .eq("email", user.email)
        .single();
      if (!error) setIsSupervisor(Boolean(data?.supervisor));
    };
    fetchFlag();
  }, [user?.email]);

  /* ========= nav items según rol ========= */
  const navItems = useMemo(
    () => (isSupervisor ? [...baseItems, stockItem] : baseItems),
    [isSupervisor]
  );

  /* ========= logout ========= */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await dispatch(logout());
    router.push("/login");
  };

  return (
    <>
      {/* ===== HEADER MÓVIL ===== */}
      <div className="md:hidden fixed top-0 left-0 z-40 w-full app-header">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500">
            32 EXPRESS
          </h1>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800"
              aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ===== MENÚ MÓVIL ===== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-white dark:bg-slate-900 pt-16">
          <nav className="px-4 py-2">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center p-3 rounded-md ${
                        isActive
                          ? "app-nav-link-active"
                          : "app-nav-link-inactive"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon
                        className={`w-5 h-5 mr-3 ${
                          isActive
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center p-3 rounded-md text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* ===== SIDEBAR ESCRITORIO ===== */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <div className="flex-1 flex flex-col min-h-0 app-sidebar">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-4">
              <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500">
                32 EXPRESS
              </h1>
              <ThemeToggle />
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`app-nav-link ${
                      isActive
                        ? "app-nav-link-active"
                        : "app-nav-link-inactive"
                    }`}
                  >
                    <item.icon
                      className={`app-nav-icon ${
                        isActive
                          ? "app-nav-icon-active"
                          : "app-nav-icon-inactive"
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ----- Footer con usuario & logout ----- */}
          <div className="flex-shrink-0 flex border-t border-slate-200 dark:border-slate-800 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="inline-block h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {user?.name || "Empleado"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user?.email || "empleado@example.com"}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="ml-2 p-1 rounded-md text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
