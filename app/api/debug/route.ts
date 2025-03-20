import { NextResponse } from "next/server"
import { getEnvironmentInfo } from "@/lib/debug-env"

export async function GET() {
  return NextResponse.json(getEnvironmentInfo())
}

