import { getEnvironmentInfo } from "@/lib/debug-env"

export default async function DebugPage() {
  const envInfo = getEnvironmentInfo()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <p className="text-yellow-700">
          Esta página muestra información de diagnóstico sobre las variables de entorno. No muestra los valores
          completos por razones de seguridad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Información del entorno</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(envInfo.environment, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Runtime</h2>
          <p className="text-lg font-mono">{envInfo.runtime}</p>
          <p className="text-sm text-gray-600 mt-1">
            {envInfo.runtime === "server"
              ? "Esta página se está renderizando en el servidor."
              : "Esta página se está renderizando en el cliente."}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Variables públicas (NEXT_PUBLIC_*)</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(envInfo.nextPublicVars, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Variables del servidor</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(envInfo.serverVars, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Pasos para solucionar problemas</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Verifica que todas las variables de entorno estén configuradas en Vercel.</li>
          <li>Asegúrate de que las variables del servidor no tengan el prefijo NEXT_PUBLIC_.</li>
          <li>Comprueba que estás usando las variables correctamente en el código.</li>
          <li>Recuerda que las variables del servidor solo están disponibles en el servidor.</li>
          <li>Fuerza un redespliegue completo en Vercel limpiando la caché.</li>
        </ol>
      </div>
    </div>
  )
}

