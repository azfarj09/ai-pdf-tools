import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { type NextRequest, NextResponse } from "next/server"
import PDFParser from "pdf2json"

export const maxDuration = 60

// PDF text extraction function using pdf2json
async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData.parserError))
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        // Extract text from all pages
        let text = ""
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                for (const run of textItem.R) {
                  try {
                    text += decodeURIComponent(run.T) + " "
                  } catch (e) {
                    // If decoding fails, use the raw text
                    text += run.T + " "
                  }
                }
              }
            }
          }
        }

        text = text.trim()

        if (!text || text.length < 50) {
          reject(new Error("Could not extract text from PDF. The file might be an image-based PDF or corrupted."))
        } else {
          resolve(text)
        }
      } catch (error) {
        reject(error)
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("pdf") as File
    const blobUrl = formData.get("blobUrl") as string

    console.log("Received request - blobUrl:", !!blobUrl, "file:", !!file)

    let pdfBuffer: Buffer

    if (blobUrl) {
      // Fetch from blob storage
      console.log("Fetching PDF from blob storage:", blobUrl)
      const response = await fetch(blobUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch from blob storage: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
      console.log("Fetched PDF buffer size:", pdfBuffer.length)
    } else if (file) {
      // Use uploaded file directly
      console.log("Using direct file upload, size:", file.size)
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
      }
      const arrayBuffer = await file.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
    } else {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    // Extract text from PDF
    console.log("Extracting text from PDF...")
    const extractedText = await extractTextFromPDFBuffer(pdfBuffer)
    console.log("Extracted text length:", extractedText.length)
    console.log("First 200 chars:", extractedText.slice(0, 200))

    // Generate summary using AI SDK with Google Gemini
    console.log("Generating summary with Gemini...")
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: `You are a professional document summarizer. Please provide a clear, structured summary of the following document text. 

Focus on:
- Main topics and key points
- Important details and findings
- Overall purpose and conclusions

Keep the summary concise but comprehensive, using clear paragraphs.

Document text:
${extractedText.slice(0, 15000)}`, // Limit text to avoid token limits
      maxOutputTokens: 1000,
      temperature: 0.3,
    })

    console.log("Result object:", JSON.stringify(result, null, 2))
    const summary = result.text
    console.log("Summary generated successfully!")
    console.log("Summary length:", summary?.length)
    console.log("Summary:", summary)
    return NextResponse.json({ summary })
  } catch (error) {
    console.error("PDF summarization error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process PDF",
      },
      { status: 500 },
    )
  }
}
