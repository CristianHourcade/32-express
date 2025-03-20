import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="container mx-auto py-10">
      <Skeleton className="h-8 w-64 mb-6" />
      <Skeleton className="h-4 w-full max-w-md mb-6" />

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full mb-4" />

          <div className="space-y-4">
            {Array(7)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex space-x-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="grid gap-1.5 leading-none w-full">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

