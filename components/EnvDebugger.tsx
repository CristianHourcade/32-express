"use client"

import { useState } from "react"
import { clientEnv } from "@/lib/env"

export function EnvDebugger() {
  const [serverEnv, setServerEnv] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchServerEnv = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/env-diagnostic")
      const data = await res.json()
      setServerEnv(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
      <h3 className="font-bold mb-2">Environment Variables Debugger</h3>

      <div className="mb-4">
        <h4 className="font-semibold mb-1">Client Environment:</h4>
        <ul className="space-y-1">
          <li>NEXT_PUBLIC_SUPABASE_URL: {clientEnv.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: {clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}</li>
          <li>Using Mock Data: {clientEnv.NEXT_PUBLIC_USE_MOCK_DATA ? "Yes" : "No"}</li>
          <li>Using Mock Auth: {clientEnv.NEXT_PUBLIC_USE_MOCK_AUTH ? "Yes" : "No"}</li>
        </ul>
      </div>

      <button
        onClick={fetchServerEnv}
        disabled={loading}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 mb-4"
      >
        {loading ? "Loading..." : "Check Server Environment"}
      </button>

      {error && (
        <div className="p-2 mb-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {serverEnv && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">Server Environment:</h4>
            <ul className="space-y-1">
              <li>Node Environment: {serverEnv.status.runtime.nodeEnv}</li>
              <li>Vercel Environment: {serverEnv.status.runtime.vercelEnv}</li>
              {serverEnv.status.runtime.isServer ? (
                <>
                  <li>SUPABASE_SERVICE_ROLE_KEY: {serverEnv.status.server.hasServiceKey ? "✅ Set" : "❌ Missing"}</li>
                  <li>DATABASE_URL: {serverEnv.status.server.hasDatabaseUrl ? "✅ Set" : "❌ Missing"}</li>
                </>
              ) : (
                <li>Server variables: Not available in browser</li>
              )}
            </ul>
          </div>

          {serverEnv.connectionTest && (
            <div>
              <h4 className="font-semibold mb-1">Connection Test:</h4>
              {serverEnv.connectionTest.skipped ? (
                <p>Skipped: {serverEnv.connectionTest.reason}</p>
              ) : serverEnv.connectionTest.success ? (
                <p className="text-green-600 dark:text-green-400">✅ Connection successful</p>
              ) : (
                <p className="text-red-600 dark:text-red-400">❌ Connection failed: {serverEnv.connectionTest.error}</p>
              )}
            </div>
          )}

          {serverEnv.issues && serverEnv.issues.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1">Issues Detected:</h4>
              <ul className="list-disc pl-5 text-red-600 dark:text-red-400">
                {serverEnv.issues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

