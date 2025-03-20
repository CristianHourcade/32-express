"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CreateBusinessData, UpdateBusinessData } from "@/services/types"

interface BusinessFormProps {
  initialData?: {
    name: string
  }
  onSubmit: (data: CreateBusinessData | UpdateBusinessData) => void
}

export default function BusinessForm({ initialData, onSubmit }: BusinessFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
  })

  const [errors, setErrors] = useState({
    name: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Limpiar errores al cambiar el valor
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    let isValid = true
    const newErrors = { name: "" }

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es obligatorio"
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (validateForm()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nombre <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Nombre del negocio"
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit">{initialData ? "Actualizar Negocio" : "Crear Negocio"}</Button>
      </div>
    </form>
  )
}

