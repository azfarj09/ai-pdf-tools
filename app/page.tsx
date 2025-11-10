"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { FileText, Sparkles, Upload, Brain, ChevronLeft, ChevronRight, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

interface Flashcard {
  question: string
  answer: string
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfText, setPdfText] = useState<string>("")
  const [summary, setSummary] = useState<string>("")
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingFlashcards, setLoadingFlashcards] = useState(false)
  const [error, setError] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const summaryRef = useRef<HTMLDivElement>(null)
  const flashcardsRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (summary && summaryRef.current) {
      summaryRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [summary])

  useEffect(() => {
    if (flashcards.length > 0 && flashcardsRef.current) {
      flashcardsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [flashcards])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type !== "application/pdf") {
        setError("Please upload a PDF file")
        return
      }
      // Check file size (limit to 50MB with blob storage)
      const maxSize = 50 * 1024 * 1024 // 50MB in bytes
      if (droppedFile.size > maxSize) {
        setError("PDF file is too large. Please upload a file smaller than 50MB.")
        return
      }
      setFile(droppedFile)
      setError("")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file")
        return
      }
      // Check file size (limit to 50MB with blob storage)
      const maxSize = 50 * 1024 * 1024 // 50MB in bytes
      if (selectedFile.size > maxSize) {
        setError("PDF file is too large. Please upload a file smaller than 50MB.")
        return
      }
      setFile(selectedFile)
      setError("")
    }
  }

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a PDF file")
      return
    }

    setLoading(true)
    setError("")
    setSummary("")

    try {
      let blobUrl = ""

      // For files larger than 4.5MB, try to upload to Vercel Blob first
      if (file.size > 4.5 * 1024 * 1024) {
        console.log("Large file detected, attempting blob storage upload...")
        try {
          const uploadResponse = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: file,
          })

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json()
            blobUrl = uploadData.url
            console.log("File uploaded to blob storage")
          } else {
            console.warn("Blob storage not configured, trying direct upload...")
          }
        } catch (uploadError) {
          console.warn("Blob upload failed, trying direct upload:", uploadError)
        }
      }

      const formData = new FormData()
      if (blobUrl) {
        formData.append("blobUrl", blobUrl)
      } else {
        formData.append("pdf", file)
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = "Failed to summarize PDF"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, try to get text
          const errorText = await response.text()
          if (errorText.includes("too large") || response.status === 413) {
            errorMessage = "PDF file is too large. Please try a smaller file."
          } else {
            errorMessage = errorText || errorMessage
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (data.summary) {
        setSummary(data.summary)
      } else {
        setError("No summary received from API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!file) {
      setError("Please select a PDF file")
      return
    }

    setLoadingFlashcards(true)
    setError("")
    setFlashcards([])
    setCurrentCardIndex(0)
    setShowAnswer(false)

    try {
      let blobUrl = ""

      // For files larger than 4.5MB, try to upload to Vercel Blob first
      if (file.size > 4.5 * 1024 * 1024) {
        try {
          const uploadResponse = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: file,
          })

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json()
            blobUrl = uploadData.url
          } else {
            console.warn("Blob storage not configured, trying direct upload...")
          }
        } catch (uploadError) {
          console.warn("Blob upload failed, trying direct upload:", uploadError)
        }
      }

      const formData = new FormData()
      if (blobUrl) {
        formData.append("blobUrl", blobUrl)
      } else {
        formData.append("pdf", file)
      }

      const response = await fetch("/api/flashcards", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = "Failed to generate flashcards"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await response.text()
          if (errorText.includes("too large") || response.status === 413) {
            errorMessage = "PDF file is too large. Please try a smaller file."
          } else {
            errorMessage = errorText || errorMessage
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (data.flashcards && data.flashcards.length > 0) {
        setFlashcards(data.flashcards)
      } else {
        setError("No flashcards received from API")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoadingFlashcards(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPdfText("")
    setSummary("")
    setFlashcards([])
    setCurrentCardIndex(0)
    setShowAnswer(false)
    setShowChat(false)
    setError("")
  }

  const handleStartChat = () => {
    if (!file) {
      setError("Please select a PDF file first")
      return
    }
    setShowChat(true)
    setTimeout(() => {
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      setShowAnswer(false)
    }
  }

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1)
      setShowAnswer(false)
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-6">
      <ThemeToggle />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <Sparkles className="w-10 h-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">AI PDF Tools</h1>
        </div>
        <p className="max-w-xl text-lg text-muted-foreground text-balance">
          Upload any PDF document to generate summaries, study flashcards, or chat with your document
        </p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Select or drag and drop your PDF file to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSummarize} className="space-y-6">
            <div
              className={`relative flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-lg transition-colors ${
                dragActive ? "border-primary bg-accent/20" : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">{file ? file.name : "Drag and drop your PDF here"}</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {error && <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">{error}</div>}

            <div className="flex gap-3">
              <Button type="submit" disabled={!file || loading} className="flex-1">
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!file || loadingFlashcards}
                onClick={handleGenerateFlashcards}
              >
                {loadingFlashcards ? (
                  <>
                    <Brain className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Flashcards
                  </>
                )}
              </Button>
              <Button type="button" variant="secondary" disabled={!file} onClick={handleStartChat}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
              {(file || summary || flashcards.length > 0) && (
                <Button type="button" variant="outline" onClick={handleReset} disabled={loading || loadingFlashcards}>
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {summary && (
        <Card ref={summaryRef} className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Summary
            </CardTitle>
            <CardDescription>AI-generated summary of your document</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 space-y-3 rounded-lg bg-muted/50">
              {summary.split("\n").map(
                (paragraph, index) =>
                  paragraph.trim() && (
                    <p key={index} className="text-sm leading-relaxed">
                      {paragraph}
                    </p>
                  ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {flashcards.length > 0 && (
        <Card ref={flashcardsRef} className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Flashcards
            </CardTitle>
            <CardDescription>
              Card {currentCardIndex + 1} of {flashcards.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="min-h-[200px] p-6 rounded-lg bg-muted/50 flex items-center justify-center cursor-pointer transition-all hover:bg-muted"
              onClick={() => setShowAnswer(!showAnswer)}
            >
              <div className="text-center space-y-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {showAnswer ? "Answer" : "Question"}
                </p>
                <p className="text-lg leading-relaxed">
                  {showAnswer ? flashcards[currentCardIndex].answer : flashcards[currentCardIndex].question}
                </p>
                <p className="text-xs text-muted-foreground">Click to {showAnswer ? "hide" : "reveal"} answer</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button variant="outline" onClick={prevCard} disabled={currentCardIndex === 0}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button onClick={() => setShowAnswer(!showAnswer)} variant="secondary">
                {showAnswer ? "Show Question" : "Show Answer"}
              </Button>
              <Button variant="outline" onClick={nextCard} disabled={currentCardIndex === flashcards.length - 1}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showChat && <ChatWithPDF file={file} chatRef={chatRef} />}
    </main>
  )
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

function ChatWithPDF({ file, chatRef }: { file: File | null; chatRef: React.RefObject<HTMLDivElement> }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [pdfText, setPdfText] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Extract PDF text once when component mounts
    if (file && !pdfText) {
      const extractText = async () => {
        const formData = new FormData()
        formData.append("pdf", file)
        formData.append("question", "extract") // dummy question to trigger extraction
        
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            body: formData,
          })
          // We'll store the text for subsequent requests
        } catch (error) {
          console.error("Failed to extract PDF text:", error)
        }
      }
      extractText()
    }
  }, [file, pdfText])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !file) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("pdf", file)
      formData.append("question", input)
      if (pdfText) {
        formData.append("pdfText", pdfText)
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""

      const assistantMessageId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          assistantMessage += chunk
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: assistantMessage } : msg
            )
          )
        }
      }
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card ref={chatRef} className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Chat with PDF
        </CardTitle>
        <CardDescription>Ask questions about your document</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[400px] overflow-y-auto space-y-4 p-4 rounded-lg bg-muted/50">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Ask a question about your PDF document
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-lg bg-background border border-border">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
