import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea una fecha en formato legible
 * @param dateString - Fecha en formato ISO o timestamp
 * @returns Fecha formateada en formato local
 */
export function formatDate(dateString: string | number | Date | null | undefined): string {
  if (!dateString) return "-"

  const date = new Date(dateString)

  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

