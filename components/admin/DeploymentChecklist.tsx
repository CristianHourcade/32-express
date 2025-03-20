"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clipboard, CheckCircle2 } from "lucide-react"

interface ChecklistItem {
  id: string
  title: string
  description: string
  checked: boolean
}

export default function DeploymentChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: "clear-cache",
      title: "Clear Vercel cache",
      description: "Use the 'Redeploy without cache' option in Vercel",
      checked: false,
    },
    {
      id: "env-vars",
      title: "Verify environment variables",
      description: "Ensure all required environment variables are set in Vercel",
      checked: false,
    },
    {
      id: "build-logs",
      title: "Check build logs",
      description: "Review Vercel build logs for any warnings or errors",
      checked: false,
    },
    {
      id: "branch",
      title: "Verify branch",
      description: "Ensure you're deploying from the correct branch",
      checked: false,
    },
    {
      id: "preview",
      title: "Test in preview environment",
      description: "Deploy to a preview environment before production",
      checked: false,
    },
    {
      id: "browser-cache",
      title: "Clear browser cache",
      description: "Test with incognito/private browsing or clear browser cache",
      checked: false,
    },
    {
      id: "cdn-cache",
      title: "Check CDN cache",
      description: "Verify CDN cache settings and consider purging if necessary",
      checked: false,
    },
    {
      id: "post-deploy",
      title: "Post-deployment verification",
      description: "Run diagnostic tools after deployment to verify everything is working",
      checked: false,
    },
  ])

  const [copied, setCopied] = useState(false)

  const toggleItem = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const resetChecklist = () => {
    setItems(items.map((item) => ({ ...item, checked: false })))
  }

  const copyInstructions = () => {
    const text = items.map((item) => `- ${item.title}: ${item.description}`).join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const progress = Math.round((items.filter((item) => item.checked).length / items.length) * 100)

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Deployment Checklist</CardTitle>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={copyInstructions}>
            {copied ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={resetChecklist}>
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertDescription>
            Complete this checklist before and after each deployment to ensure your changes are properly reflected.
            Current progress: {progress}%
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex space-x-2">
              <Checkbox id={item.id} checked={item.checked} onCheckedChange={() => toggleItem(item.id)} />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor={item.id}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    item.checked ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {item.title}
                </label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <h3 className="font-medium">Additional Recommendations</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Use the Deployment Diagnostic tool to verify your deployment</li>
            <li>Consider implementing a CI/CD pipeline for more reliable deployments</li>
            <li>Document any deployment-specific steps in your project README</li>
            <li>Set up monitoring to be alerted of deployment failures</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

