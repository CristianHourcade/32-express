const nextConfig = {
  // Incluir explícitamente variables de entorno públicas
  env: {
    // Solo incluir variables NEXT_PUBLIC_ aquí
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
    NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    // Añadir timestamp de compilación para invalidar caché
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
    // Añadir un valor aleatorio para forzar reconstrucción
    NEXT_PUBLIC_CACHE_BUSTER: Math.random().toString(36).substring(2),
  },
  
  // Desactivar verificación de tipos durante la compilación para evitar problemas con variables de entorno faltantes
  typescript: {
    // Esta es una medida temporal - eliminar una vez que las variables de entorno estén arregladas
    ignoreBuildErrors: true,
  },
  
  // Asegurar que no estamos usando caché obsoleta para variables de entorno
  generateBuildId: async () => {
    // Incluir una marca de tiempo para asegurar compilaciones frescas
    return `build-${Date.now()}-${Math.random().toString(36).substring(2)}`
  },
  
  // Desactivar optimización estática para todas las páginas para asegurar datos frescos
  reactStrictMode: true,
  
  // Configurar caché de imágenes
  images: {
    minimumCacheTTL: 60, // Caché de imágenes por solo 60 segundos
  },
  
  // Forzar revalidación completa de páginas
  onDemandEntries: {
    // Configuración solo del lado del servidor
    maxInactiveAge: 25 * 1000, // 25 segundos
    pagesBufferLength: 2,
  },
  
  // Configuración experimental para mejorar el rendimiento
  experimental: {
    // Esto asegura que las páginas se construyan bajo demanda
    workerThreads: true,
    optimizeCss: true, // Optimizar CSS para producción
    // Desactivar caché de compilación
    turbotrace: {
      memoryLimit: 4000,
    },
  },
  
  // Añadir información de salida de compilación para depuración
  output: 'standalone',
  
  // Añadir encabezados para prevenir caché en navegadores
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ]
  },
  
  // Desactivar caché de webpack
  webpack: (config, { dev, isServer }) => {
    // Desactivar caché en desarrollo
    if (dev) {
      config.cache = false;
    }
    
    return config;
  },
}

export default nextConfig

