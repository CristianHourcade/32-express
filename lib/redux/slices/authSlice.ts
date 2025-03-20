import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import {
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
  updatePassword,
  getCurrentUser,
} from "@/services/auth/authService"

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "employee"
  businessId?: string
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  message: string | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
  message: null,
}

// Thunks
export const login = createAsyncThunk(
  "auth/login",
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      console.log("🔐 Auth Slice: Login thunk started", { email: credentials.email })
      const response = await loginUser(credentials)

      if (response.error) {
        console.log("🔐 Auth Slice: Login failed", { error: response.error })
        return rejectWithValue(response.error)
      }

      console.log("🔐 Auth Slice: Login successful", {
        user: response.user
          ? {
              ...response.user,
              id: response.user.id.substring(0, 8) + "...",
            }
          : null,
        hasToken: !!response.token,
      })

      return response
    } catch (error) {
      console.error("🔐 Auth Slice: Unexpected login error", error)
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue("Error desconocido durante el inicio de sesión")
    }
  },
)

export const logout = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try {
    const response = await logoutUser()
    if (response.error) {
      return rejectWithValue(response.error)
    }
    return response
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message)
    }
    return rejectWithValue("Error desconocido durante el cierre de sesión")
  }
})

export const register = createAsyncThunk(
  "auth/register",
  async (
    userData: {
      name: string
      email: string
      password: string
      role?: "admin" | "employee"
      businessId?: string
    },
    { rejectWithValue },
  ) => {
    try {
      console.log("Registering user:", userData)
      const response = await registerUser(userData)
      if (response.error) {
        console.error("Registration error:", response.error)
        return rejectWithValue(response.error)
      }
      console.log("Registration successful:", response)
      return response
    } catch (error) {
      console.error("Unexpected registration error:", error)
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue("Error desconocido durante el registro")
    }
  },
)

export const forgotPassword = createAsyncThunk("auth/forgotPassword", async (email: string, { rejectWithValue }) => {
  try {
    const response = await resetPassword(email)
    if (response.error) {
      return rejectWithValue(response.error)
    }
    return response
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message)
    }
    return rejectWithValue("Error desconocido al solicitar restablecimiento de contraseña")
  }
})

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (newPassword: string, { rejectWithValue }) => {
    try {
      const response = await updatePassword(newPassword)
      if (response.error) {
        return rejectWithValue(response.error)
      }
      return response
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }
      return rejectWithValue("Error desconocido al actualizar la contraseña")
    }
  },
)

export const checkAuth = createAsyncThunk("auth/checkAuth", async (_, { rejectWithValue }) => {
  try {
    console.log("🔐 Auth Slice: CheckAuth thunk started")
    const response = await getCurrentUser()

    if (response.error) {
      console.log("🔐 Auth Slice: CheckAuth failed", { error: response.error })
      return rejectWithValue(response.error)
    }

    console.log("🔐 Auth Slice: CheckAuth completed", {
      user: response.user
        ? {
            ...response.user,
            id: response.user.id.substring(0, 8) + "...",
          }
        : null,
    })

    return response
  } catch (error) {
    console.error("🔐 Auth Slice: Unexpected checkAuth error", error)
    if (error instanceof Error) {
      return rejectWithValue(error.message)
    }
    return rejectWithValue("Error desconocido al verificar la autenticación")
  }
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearMessage: (state) => {
      state.message = null
    },
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false
      state.isAuthenticated = true
      state.user = action.payload.user
      state.token = action.payload.token
    })
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Logout
    builder.addCase(logout.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(logout.fulfilled, (state) => {
      state.loading = false
      state.isAuthenticated = false
      state.user = null
      state.token = null
    })
    builder.addCase(logout.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Register
    builder.addCase(register.pending, (state) => {
      state.loading = true
      state.error = null
      state.message = null
    })
    builder.addCase(register.fulfilled, (state, action) => {
      state.loading = false
      if (action.payload.user) {
        state.isAuthenticated = true
        state.user = action.payload.user
      } else {
        state.message = "Registro exitoso. Por favor, verifica tu correo electrónico."
      }
    })
    builder.addCase(register.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Forgot Password
    builder.addCase(forgotPassword.pending, (state) => {
      state.loading = true
      state.error = null
      state.message = null
    })
    builder.addCase(forgotPassword.fulfilled, (state) => {
      state.loading = false
      state.message = "Se ha enviado un enlace de restablecimiento de contraseña a tu correo electrónico."
    })
    builder.addCase(forgotPassword.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Change Password
    builder.addCase(changePassword.pending, (state) => {
      state.loading = true
      state.error = null
      state.message = null
    })
    builder.addCase(changePassword.fulfilled, (state) => {
      state.loading = false
      state.message = "Contraseña actualizada exitosamente."
    })
    builder.addCase(changePassword.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Check Auth
    builder.addCase(checkAuth.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(checkAuth.fulfilled, (state, action) => {
      state.loading = false
      if (action.payload.user) {
        state.isAuthenticated = true
        state.user = action.payload.user
      } else {
        state.isAuthenticated = false
        state.user = null
        state.token = null
      }
    })
    builder.addCase(checkAuth.rejected, (state) => {
      state.loading = false
      state.isAuthenticated = false
      state.user = null
      state.token = null
    })
  },
})

export const { clearError, clearMessage } = authSlice.actions
export default authSlice.reducer

