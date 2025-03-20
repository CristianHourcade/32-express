import type { Metadata } from "next"
import DeploymentChecklist from "@/components/admin/DeploymentChecklist"

export const metadata: Metadata = {
  title: "Deployment Checklist",
  description: "Checklist for successful deployments",
}

export default function DeploymentChecklistPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Deployment Checklist</h1>
      <p className="text-muted-foreground mb-6">
        Use this checklist to ensure your deployments are successful and reflect the latest changes.
      </p>
      <DeploymentChecklist />
    </div>
  )
}

