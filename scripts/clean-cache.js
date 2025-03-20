const fs = require("fs")
const path = require("path")

// Limpiar caché de Next.js
const cacheDirectories = [".next/cache", "node_modules/.cache"]

cacheDirectories.forEach((dir) => {
  const cachePath = path.join(process.cwd(), dir)
  if (fs.existsSync(cachePath)) {
    console.log(`Limpiando caché en: ${cachePath}`)
    fs.rmSync(cachePath, { recursive: true, force: true })
  }
})

// Crear un archivo de marca de tiempo para forzar reconstrucción
const timestamp = new Date().toISOString()
fs.writeFileSync(path.join(process.cwd(), ".cache-buster"), `CACHE_BUSTER=${timestamp}\n`)

console.log("Caché limpiado exitosamente")

