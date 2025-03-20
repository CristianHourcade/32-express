import type { Metadata } from "next"
import DeploymentDiagnostic from "@/components/admin/DeploymentDiagnostic"

export const metadata: Metadata = {
  title: "Deployment Diagnostic",
  description: "Diagnose and fix deployment issues",
}

export default function DeploymentDiagnosticPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Deployment Diagnostic</h1>
      <p className="text-muted-foreground mb-6">
        Use this tool to diagnose issues with deployments not reflecting the latest code changes.
      </p>
      <DeploymentDiagnostic />
    </div>
  )
}

