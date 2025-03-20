import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import { fetchProducts, addProduct, updateProduct, deleteProduct } from "@/services/admin/productService"

export interface Product {
  id: string
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  minStock: number
  description: string
  createdAt: string
  businessId: string
  salesCount: number
  totalRevenue: number
}

interface ProductState {
  products: Product[]
  loading: boolean
  error: string | null
}

const initialState: ProductState = {
  products: [],
  loading: false,
  error: null,
}

export const getProducts = createAsyncThunk("products/getProducts", async () => {
  const response = await fetchProducts()
  return response
})

export const createProduct = createAsyncThunk("products/createProduct", async (product: Omit<Product, "id">) => {
  const response = await addProduct(product)
  return response
})

export const editProduct = createAsyncThunk("products/editProduct", async (product: Product) => {
  const response = await updateProduct(product)
  return response
})

export const removeProduct = createAsyncThunk("products/removeProduct", async (id: string) => {
  await deleteProduct(id)
  return id
})

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getProducts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.loading = false
        state.products = action.payload
      })
      .addCase(getProducts.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch products"
      })
      .addCase(createProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.products.push(action.payload)
      })
      .addCase(editProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        const index = state.products.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.products[index] = action.payload
        }
      })
      .addCase(removeProduct.fulfilled, (state, action: PayloadAction<string>) => {
        state.products = state.products.filter((p) => p.id !== action.payload)
      })
  },
})

export default productSlice.reducer

