import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { type NextRequest, NextResponse } from "next/server"
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

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(file)

    // Generate flashcards using AI SDK with Google Gemini
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: `You are a professional educator creating study flashcards. Based on the following document text, create 10-15 high-quality flashcards.

Format your response as a JSON array with this exact structure:
[
  {
    "question": "Question text here",
    "answer": "Answer text here"
  }
]

Guidelines:
- Focus on key concepts, definitions, and important facts
- Make questions clear and specific
- Keep answers concise but complete
- Cover different aspects of the material
- Use varied question types (what, why, how, define, etc.)

Document text:
${extractedText.slice(0, 15000)}`,
      maxOutputTokens: 2000,
      temperature: 0.7,
    })

    const flashcardsText = result.text
    
    // Parse the JSON response
    let flashcards
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = flashcardsText.match(/```json\n?([\s\S]*?)\n?```/) || flashcardsText.match(/\[[\s\S]*\]/)
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : flashcardsText
      flashcards = JSON.parse(jsonText)
    } catch (parseError) {
      console.error("Failed to parse flashcards JSON:", parseError)
      return NextResponse.json({ error: "Failed to generate valid flashcards" }, { status: 500 })
    }

    return NextResponse.json({ flashcards })
  } catch (error) {
    console.error("PDF flashcard generation error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate flashcards",
      },
      { status: 500 },
    )
  }
}
