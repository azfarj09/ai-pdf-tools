import { streamText } from "ai"
import { google } from "@ai-sdk/google"
import { type NextRequest } from "next/server"
import PDFParser from "pdf2json"

export const maxDuration = 60

// PDF text extraction function using pdf2json
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData.parserError))
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
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
    const question = formData.get("question") as string
    const pdfText = formData.get("pdfText") as string

    if (!question) {
      return new Response("No question provided", { status: 400 })
    }

    let extractedText = pdfText

    // If pdfText is not provided, extract it from the file
    if (!extractedText && file) {
      if (file.type !== "application/pdf") {
        return new Response("File must be a PDF", { status: 400 })
      }
      extractedText = await extractTextFromPDF(file)
    }

    if (!extractedText) {
      return new Response("No PDF content available", { status: 400 })
    }

    // Stream the response using AI SDK
    const result = streamText({
      model: google("gemini-2.0-flash"),
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that answers questions about PDF documents. 
          
Here is the content of the PDF document:

${extractedText.slice(0, 30000)}

Answer questions based on this document content. Be concise, accurate, and cite specific information from the document when relevant. If the answer is not in the document, say so.`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.3,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("PDF chat error:", error)
    return new Response(error instanceof Error ? error.message : "Failed to process chat", { status: 500 })
  }
}
