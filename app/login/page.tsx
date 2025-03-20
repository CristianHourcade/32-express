"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { login, clearError, clearMessage } from "@/lib/redux/slices/authSlice"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import { clientEnv } from "@/lib/env"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({ email: "", password: "" })
  const [envError, setEnvError] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()

  const { isAuthenticated, user, loading, error, message } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    // Check environment variables
    if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL || !clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setEnvError("Missing Supabase environment variables. Authentication may not work properly.")
    } else {
      setEnvError(null)
    }

    // Clear previous errors
    dispatch(clearError())
    dispatch(clearMessage())

    console.log("🔐 Login page loaded, auth state:", {
      isAuthenticated,
      user: user ? { ...user, id: user.id.substring(0, 8) + "..." } : null,
      loading,
      error,
      message,
      env: {
        hasSupabaseUrl: !!clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        mockAuth: clientEnv.NEXT_PUBLIC_USE_MOCK_AUTH,
      },
    })

    // Redirect if already authenticated
    if (isAuthenticated && user) {
      console.log(`🔐 User already authenticated, redirecting to ${user.role} dashboard`)
      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else {
        router.push("/employee/dashboard")
      }
    }
  }, [isAuthenticated, user, router, dispatch])

  const validateForm = () => {
    let valid = true
    const errors = { email: "", password: "" }

    if (!email) {
      errors.email = "El correo electrónico es obligatorio"
      valid = false
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "El correo electrónico no es válido"
      valid = false
    }

    if (!password) {
      errors.password = "La contraseña es obligatoria"
      valid = false
    }

    setFormErrors(errors)
    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("🔐 Login attempt:", { email })

    if (validateForm()) {
      console.log("🔐 Form validation passed, dispatching login action")
      dispatch(login({ email, password }))
    } else {
      console.log("🔐 Form validation failed")
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-4xl font-extrabold text-sky-600 dark:text-sky-500">32 EXPRESS</h1>
          <h2 className="mt-2 text-center text-xl text-slate-600 dark:text-slate-400">Inicia sesión en tu cuenta</h2>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-900 py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-slate-200 dark:border-slate-800">
          {envError && (
            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">{envError}</p>
                  <p className="text-sm mt-2">
                    <Link href="/login/debug" className="text-yellow-700 dark:text-yellow-400 underline">
                      View diagnostics
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error === "Invalid credentials" ? "Correo electrónico o contraseña incorrectos" : error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Correo electrónico
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2 border ${
                    formErrors.email
                      ? "border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      : "border-slate-300 dark:border-slate-700 focus:ring-sky-500 focus:border-sky-500"
                  } rounded-md shadow-sm placeholder-slate-400 dark:bg-slate-800 dark:text-white sm:text-sm`}
                  placeholder="tu@ejemplo.com"
                />
              </div>
              {formErrors.email && <p className="mt-2 text-sm text-red-600 dark:text-red-500">{formErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-2 border ${
                    formErrors.password
                      ? "border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      : "border-slate-300 dark:border-slate-700 focus:ring-sky-500 focus:border-sky-500"
                  } rounded-md shadow-sm placeholder-slate-400 dark:bg-slate-800 dark:text-white sm:text-sm`}
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="text-slate-400 hover:text-slate-500 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              {formErrors.password && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-500">{formErrors.password}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </span>
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar sesión"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

