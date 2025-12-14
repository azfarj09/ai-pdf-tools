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
      const errorMsg = errData.parserError || ""
      if (errorMsg.includes("encryption") || errorMsg.includes("Encrypt")) {
        reject(new Error("This PDF is encrypted or password-protected. Please use an unencrypted PDF."))
      } else {
        reject(new Error(errData.parserError || "Failed to parse PDF"))
      }
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

    try {
      pdfParser.parseBuffer(buffer)
    } catch (parseError) {
      reject(new Error("Failed to parse PDF. The file might be encrypted, password-protected, or corrupted."))
    }
  })
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[${requestId}] === NEW SUMMARIZE REQUEST ===`)
  
  try {
    const formData = await req.formData()
    const file = formData.get("pdf") as File
    const blobUrl = formData.get("blobUrl") as string

    console.log(`[${requestId}] Received request - blobUrl:`, !!blobUrl, "file:", !!file)

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
    console.log(`[${requestId}] Extracting text from PDF...`)
    const extractedText = await extractTextFromPDFBuffer(pdfBuffer)
    console.log(`[${requestId}] Extracted text length:`, extractedText.length)
    console.log(`[${requestId}] First 200 chars:`, extractedText.slice(0, 200))

    // Generate summary using AI SDK with Google Gemini
    console.log(`[${requestId}] Generating summary with Gemini...`)
    
    try {
      const result = await generateText({
        model: google("gemini-2.5-flash"),
        prompt: `You are a professional document summarizer. Please provide a clear, structured summary of the following document text. 

Focus on:
- Main topics and key points
- Important details and findings
- Overall purpose and conclusions

Keep the summary concise but comprehensive, using clear paragraphs.

Document text:
${extractedText.slice(0, 30000)}`, // Increased from 15000 to 30000
        maxOutputTokens: 4096,
        temperature: 0.3,
      })

      console.log(`[${requestId}] Result object:`, JSON.stringify(result, null, 2))
      const summary = result.text
      
      if (!summary || summary.trim().length === 0) {
        console.error(`[${requestId}] No content received from AI`)
        throw new Error("No content received from AI")
      }
      
      console.log(`[${requestId}] Summary generated successfully!`)
      console.log(`[${requestId}] Summary length:`, summary?.length)
      return NextResponse.json({ summary })
    } catch (aiError: any) {
      console.error(`[${requestId}] AI generation error:`, aiError)
      console.error(`[${requestId}] Error details:`, {
        message: aiError?.message,
        status: aiError?.status,
        statusText: aiError?.statusText,
        cause: aiError?.cause
      })
      
      // Check for rate limit errors
      if (aiError?.message?.includes("429") || 
          aiError?.message?.includes("quota") || 
          aiError?.message?.includes("rate limit") ||
          aiError?.message?.includes("RESOURCE_EXHAUSTED")) {
        return NextResponse.json(
          { error: "Rate limit reached. Please wait a moment and try again." },
          { status: 429 }
        )
      }
      
      throw aiError
    }
  } catch (error: any) {
    console.error(`[${requestId}] PDF summarization error:`, error)
    console.error(`[${requestId}] Full error:`, JSON.stringify(error, null, 2))
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process PDF",
      },
      { status: 500 },
    )
  }
}
