"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function SupabaseTest() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function testConnection() {
      try {
        // Intenta hacer una consulta simple
        const { data, error } = await supabase.from("businesses").select("name").limit(1)

        if (error) {
          throw error
        }

        setStatus("success")
        setMessage(`Conexión exitosa! Encontrado: ${data.length} negocio(s)`)
      } catch (error) {
        console.error("Error al conectar con Supabase:", error)
        setStatus("error")
        setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-bold mb-2">Prueba de conexión a Supabase</h2>
      <div
        className={`p-2 rounded ${
          status === "loading"
            ? "bg-gray-100"
            : status === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
        }`}
      >
        {status === "loading" ? "Conectando..." : message}
      </div>
    </div>
  )
}

