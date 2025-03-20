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
          <Skeleton className="h-9 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-4">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-start space-x-2 p-2 border rounded">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="w-full">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-3 w-full mt-1" />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

