export default function Loading() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando productos...</p>
      </div>
    </div>
  )
}

