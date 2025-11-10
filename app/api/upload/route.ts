import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const filename = searchParams.get("filename")

  if (!filename || !request.body) {
    return NextResponse.json({ error: "Filename and file required" }, { status: 400 })
  }

  // Check if blob token is configured (check both possible names)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.pdfuploads_READ_WRITE_TOKEN
  if (!blobToken) {
    console.warn("Blob token not configured")
    return NextResponse.json(
      { error: "Blob storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable." },
      { status: 503 }
    )
  }
  
  console.log("Blob token found, uploading file:", filename)

  try {
    const blob = await put(filename, request.body, {
      access: "public",
      token: blobToken, // Explicitly pass the token
    })

    return NextResponse.json(blob)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    )
  }
}
