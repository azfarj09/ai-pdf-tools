import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    // Get the token from environment (check both possible names)
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.pdfuploads_READ_WRITE_TOKEN
    
    if (!token) {
      console.error("No blob token found in environment")
      return NextResponse.json(
        { error: "Blob storage not configured" },
        { status: 503 }
      )
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
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
