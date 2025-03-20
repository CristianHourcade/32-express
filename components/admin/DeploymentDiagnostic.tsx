"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { getEnvironmentStatus } from "@/lib/config"

interface DiagnosticResult {
  name: string
  status: "success" | "error" | "warning"
  message: string
  details?: string
}

export default function DeploymentDiagnostic() {
  const [buildInfo, setBuildInfo] = useState<any>(null)
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deploymentTime, setDeploymentTime] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("diagnostics")

  // Fetch build info from the server
  const fetchBuildInfo = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/deployment/info")
      if (!response.ok) throw new Error("Failed to fetch build info")
      const data = await response.json()
      setBuildInfo(data)

      // Set deployment time
      if (data.buildTimestamp) {
        const deployDate = new Date(data.buildTimestamp)
        setDeploymentTime(deployDate.toLocaleString())
      }

      // Run diagnostics based on the build info
      runDiagnostics(data)
    } catch (error) {
      console.error("Error fetching build info:", error)
      setDiagnosticResults([
        {
          name: "API Connection",
          status: "error",
          message: "Failed to connect to diagnostic API",
          details: error instanceof Error ? error.message : String(error),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Run diagnostics based on build info
  const runDiagnostics = (data: any) => {
    const results: DiagnosticResult[] = []

    // Check build timestamp
    if (data.buildTimestamp) {
      const buildDate = new Date(data.buildTimestamp)
      const now = new Date()
      const diffHours = (now.getTime() - buildDate.getTime()) / (1000 * 60 * 60)

      if (diffHours < 1) {
        results.push({
          name: "Build Freshness",
          status: "success",
          message: "Build is recent (less than 1 hour old)",
        })
      } else if (diffHours < 24) {
        results.push({
          name: "Build Freshness",
          status: "warning",
          message: `Build is ${Math.round(diffHours)} hours old`,
        })
      } else {
        results.push({
          name: "Build Freshness",
          status: "error",
          message: `Build is ${Math.round(diffHours / 24)} days old`,
        })
      }
    } else {
      results.push({
        name: "Build Timestamp",
        status: "error",
        message: "No build timestamp found",
      })
    }

    // Check environment variables
    const envStatus = getEnvironmentStatus()

    if (envStatus.supabase.configured) {
      results.push({
        name: "Supabase Configuration",
        status: "success",
        message: "Supabase environment variables are configured",
      })
    } else {
      results.push({
        name: "Supabase Configuration",
        status: "error",
        message: "Supabase environment variables are missing",
      })
    }

    // Check build ID format
    if (data.buildId && data.buildId.startsWith("build-")) {
      results.push({
        name: "Build ID",
        status: "success",
        message: "Build ID uses timestamp format to prevent caching issues",
      })
    } else {
      results.push({
        name: "Build ID",
        status: "warning",
        message: "Build ID may not prevent caching issues",
      })
    }

    // Check cache headers
    if (data.cacheControl && data.cacheControl.includes("no-store")) {
      results.push({
        name: "Cache Headers",
        status: "success",
        message: "Cache-Control headers are properly set to prevent caching",
      })
    } else {
      results.push({
        name: "Cache Headers",
        status: "warning",
        message: "Cache-Control headers may not be properly configured",
      })
    }

    // Check for environment mismatches
    if (data.clientEnv && data.serverEnv) {
      const mismatches = Object.keys(data.clientEnv).filter((key) => data.clientEnv[key] !== data.serverEnv[key])

      if (mismatches.length === 0) {
        results.push({
          name: "Environment Consistency",
          status: "success",
          message: "Client and server environments match",
        })
      } else {
        results.push({
          name: "Environment Consistency",
          status: "error",
          message: `${mismatches.length} environment variables mismatch between client and server`,
          details: `Mismatched variables: ${mismatches.join(", ")}`,
        })
      }
    }

    setDiagnosticResults(results)
  }

  // Run diagnostics on component mount
  useEffect(() => {
    fetchBuildInfo()
  }, [])

  // Get status icon based on diagnostic result
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Deployment Diagnostic</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchBuildInfo} disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Diagnostics
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="diagnostics" onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            <TabsTrigger value="buildInfo">Build Info</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostics">
            {deploymentTime && (
              <Alert className="mb-4">
                <AlertTitle>Current Deployment</AlertTitle>
                <AlertDescription>
                  This environment was deployed on: <strong>{deploymentTime}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {diagnosticResults.length > 0 ? (
                diagnosticResults.map((result, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 border rounded">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{result.name}</h4>
                        <Badge
                          variant={
                            result.status === "success"
                              ? "default"
                              : result.status === "warning"
                                ? "outline"
                                : "destructive"
                          }
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && <p className="text-xs mt-1 text-muted-foreground">{result.details}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-4">
                  {isLoading ? "Running diagnostics..." : "No diagnostic results available"}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="buildInfo">
            {buildInfo ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Build Information</h3>
                  <div className="bg-muted p-3 rounded text-sm">
                    <div>
                      <strong>Build ID:</strong> {buildInfo.buildId || "Not available"}
                    </div>
                    <div>
                      <strong>Environment:</strong> {buildInfo.environment || "Not available"}
                    </div>
                    <div>
                      <strong>Node Version:</strong> {buildInfo.nodeVersion || "Not available"}
                    </div>
                    <div>
                      <strong>Next.js Version:</strong> {buildInfo.nextVersion || "Not available"}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-2">Environment Variables</h3>
                  <div className="bg-muted p-3 rounded text-sm">
                    <h4 className="text-xs uppercase font-bold mb-1">Public Variables</h4>
                    {buildInfo.publicEnvVars ? (
                      Object.entries(buildInfo.publicEnvVars).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong> {String(value).substring(0, 30)}
                          {String(value).length > 30 ? "..." : ""}
                        </div>
                      ))
                    ) : (
                      <div>No public environment variables available</div>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-2">Cache Configuration</h3>
                  <div className="bg-muted p-3 rounded text-sm">
                    <div>
                      <strong>Cache-Control:</strong> {buildInfo.cacheControl || "Not configured"}
                    </div>
                    <div>
                      <strong>Static Generation:</strong> {buildInfo.staticGeneration ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                {isLoading ? "Loading build information..." : "No build information available"}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Deployment Recommendations</AlertTitle>
                <AlertDescription>
                  Based on the diagnostic results, here are recommendations to fix deployment issues.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h3 className="font-medium">1. Vercel Project Settings</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>
                    Ensure <strong>Build and Development Settings</strong> are correctly configured
                  </li>
                  <li>
                    Verify that the <strong>Output Directory</strong> is set to the default (.next)
                  </li>
                  <li>
                    Check that <strong>Install Command</strong> is set to <code>npm install</code> or{" "}
                    <code>yarn install</code>
                  </li>
                  <li>
                    Ensure <strong>Build Command</strong> is set to <code>npm run build</code> or{" "}
                    <code>yarn build</code>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">2. Cache Invalidation</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>
                    Use the <strong>Redeploy without cache</strong> option in Vercel for the next deployment
                  </li>
                  <li>
                    Add <code>GENERATE_SOURCEMAP=false</code> to environment variables to reduce build size
                  </li>
                  <li>
                    Consider adding a version query parameter to API calls: <code>?v={Date.now()}</code>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">3. Environment Variables</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Verify all required environment variables are set in Vercel's project settings</li>
                  <li>
                    Ensure environment variables are the same across all environments (Development, Preview, Production)
                  </li>
                  <li>Check for any sensitive environment variables that might be missing in production</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">4. Build Process</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Review Vercel build logs for any warnings or errors</li>
                  <li>Check for any dependencies that might be causing issues during build</li>
                  <li>
                    Consider adding <code>--no-cache</code> to your build command temporarily
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

