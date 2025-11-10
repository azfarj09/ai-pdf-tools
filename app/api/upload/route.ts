import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // You can add validation here if needed
        return {
          allowedContentTypes: ["application/pdf"],
          tokenPayload: JSON.stringify({}),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Upload completed:", blob.pathname)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 400 }
    )
  }
}
