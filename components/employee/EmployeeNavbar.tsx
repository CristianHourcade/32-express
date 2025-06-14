"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { logout } from "@/lib/redux/slices/authSlice";
import {
  BarChart,
  Package,
  PlusCircle,
  Save,
  Package2Icon,
  LogOut,
  Menu,
  X,
  UserIcon,
  Activity,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const employeeItems = [
  { name: "Dashboard", href: "/employee/dashboard", icon: BarChart },
  { name: "Productos", href: "/employee/products", icon: Package },
  { name: "Nueva Venta", href: "/employee/new-sale", icon: PlusCircle },
];

const supervisorItems = [
  { name: "Stock", href: "/employee/stock", icon: Save },
  { name: "Inventario", href: "/employee/productos", icon: Package2Icon },
  { name: "Actividad", href: "/employee/actividad", icon: Activity },
];

export default function EmployeeNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const [isSupervisor, setIsSupervisor] = useState(false);
  useEffect(() => {
    async function fetchFlag() {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("employees")
        .select("supervisor")
        .eq("email", user.email)
        .single();
      if (!error) setIsSupervisor(Boolean(data?.supervisor));
    }
    fetchFlag();
  }, [user?.email]);

  const navItems = isSupervisor ? supervisorItems : employeeItems;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await dispatch(logout());
    router.push("/login");
  };

  return (
    <header className="w-full bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 md:py-3">
        {/* Logo */}
        <Link href="/employee/dashboard" className="flex items-center">
          <span className="text-2xl md:text-3xl font-semibold text-sky-600 dark:text-sky-500">
            32 EXPRESS
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-grow justify-center space-x-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-2 px-6 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500
                  ${isActive
                    ? 'bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
                  }
                `}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-lg font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu & User */}
        <div className="flex items-center space-x-4">
          <MobileMenu navItems={navItems} pathname={pathname} />
          <div className="hidden md:flex items-center space-x-3 border-l border-gray-200 dark:border-slate-800 pl-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-base text-gray-700 dark:text-gray-300">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 text-red-600 hover:text-red-800 dark:hover:text-red-300 transition-colors"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({
  navItems,
  pathname,
}: {
  navItems: { name: string; href: string; icon: any }[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const handleLogout = async () => {
    setOpen(false);
    await dispatch(logout());
    router.push("/login");
  };

  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 bg-white dark:bg-slate-900 shadow-md mt-1 rounded-md overflow-hidden w-[50vw]">
          <nav className="flex flex-col p-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center space-x-2 p-3 rounded-md transition-colors
                    ${isActive
                      ? 'bg-sky-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-base font-medium">{item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="mt-2 flex items-center space-x-2 p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-base font-medium">Cerrar sesión</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
