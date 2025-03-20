import { EnvDebugger } from "@/components/EnvDebugger"

export default function LoginDebugPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-sky-600 dark:text-sky-500">
            Environment Diagnostics
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Use this page to diagnose environment variable issues
          </p>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-900 py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-slate-200 dark:border-slate-800">
          <EnvDebugger />

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="font-bold mb-2">Troubleshooting Steps:</h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>Verify environment variables are set in Vercel dashboard</li>
              <li>Check for exact naming (case-sensitive)</li>
              <li>Ensure client variables have NEXT_PUBLIC_ prefix</li>
              <li>Force a clean rebuild in Vercel (clear cache)</li>
              <li>Check browser console for detailed error messages</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

