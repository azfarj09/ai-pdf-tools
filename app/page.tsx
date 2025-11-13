"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { FileText, Sparkles, Upload, Brain, ChevronLeft, ChevronRight, MessageCircle, Send, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { PDFViewer } from "@/components/pdf-viewer"

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
  const [showPreview, setShowPreview] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("")

  const summaryRef = useRef<HTMLDivElement>(null)
  const flashcardsRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    // Create preview URL when file is selected
    if (file) {
      const url = URL.createObjectURL(file)
      setPdfPreviewUrl(url)

      // Cleanup function to revoke the URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setPdfPreviewUrl("")
    }
  }, [file])

  useEffect(() => {
    // Scroll to preview when it's shown
    if (showPreview && previewRef.current) {
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    }
  }, [showPreview])

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

      // For files larger than 4.5MB, upload directly to Vercel Blob using client upload
      if (file.size > 4.5 * 1024 * 1024) {
        console.log("Large file detected, uploading to blob storage...")
        try {
          // Use Vercel Blob client upload
          const { upload } = await import("@vercel/blob/client")
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ filename: file.name }),
          })
          blobUrl = blob.url
          console.log("File uploaded to blob storage:", blobUrl)
        } catch (uploadError) {
          console.error("Blob upload failed:", uploadError)
          console.warn("Trying direct upload (may fail for large files)...")
        }
      }

      const formData = new FormData()
      if (blobUrl) {
        console.log("Using blob URL:", blobUrl)
        formData.append("blobUrl", blobUrl)
      } else {
        console.log("Using direct file upload")
        formData.append("pdf", file)
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      })
      
      console.log("Response status:", response.status)

      if (!response.ok) {
        let errorMessage = "Failed to summarize PDF"
        
        // Clone the response so we can try multiple parsing methods
        const responseClone = response.clone()
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, try to get text from the clone
          try {
            const errorText = await responseClone.text()
            if (errorText.includes("too large") || response.status === 413) {
              errorMessage = "PDF file is too large. Please try a smaller file."
            } else if (errorText) {
              errorMessage = errorText
            }
          } catch {
            // If both fail, use status-based message
            if (response.status === 413) {
              errorMessage = "PDF file is too large. Please try a smaller file."
            }
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

      // For files larger than 4.5MB, upload directly to Vercel Blob using client upload
      if (file.size > 4.5 * 1024 * 1024) {
        console.log("Large file detected, uploading to blob storage...")
        try {
          const { upload } = await import("@vercel/blob/client")
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ filename: file.name }),
          })
          blobUrl = blob.url
          console.log("File uploaded to blob storage:", blobUrl)
        } catch (uploadError) {
          console.error("Blob upload failed:", uploadError)
          console.warn("Trying direct upload (may fail for large files)...")
        }
      }

      const formData = new FormData()
      if (blobUrl) {
        console.log("Using blob URL for flashcards:", blobUrl)
        formData.append("blobUrl", blobUrl)
      } else {
        console.log("Using direct file upload for flashcards")
        formData.append("pdf", file)
      }

      const response = await fetch("/api/flashcards", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = "Failed to generate flashcards"
        
        // Clone the response so we can try multiple parsing methods
        const responseClone = response.clone()
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, try to get text from the clone
          try {
            const errorText = await responseClone.text()
            if (errorText.includes("too large") || response.status === 413) {
              errorMessage = "PDF file is too large. Please try a smaller file."
            } else if (errorText) {
              errorMessage = errorText
            }
          } catch {
            // If both fail, use status-based message
            if (response.status === 413) {
              errorMessage = "PDF file is too large. Please try a smaller file."
            }
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
    setShowPreview(false)
    setPdfPreviewUrl("")
    setError("")
  }

  const handlePreviewPDF = () => {
    if (!file) {
      setError("Please select a PDF file first")
      return
    }
    setShowPreview(true)
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
              <Button type="button" variant="secondary" disabled={!file} onClick={handlePreviewPDF}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
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

      {showPreview && pdfPreviewUrl && (
        <Card ref={previewRef} className="w-full max-w-2xl">
          <CardHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-0 h-8 w-8"
              onClick={() => setShowPreview(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              PDF Preview
            </CardTitle>
            <CardDescription>Full document preview</CardDescription>
          </CardHeader>
          <CardContent>
            <PDFViewer fileUrl={pdfPreviewUrl} />
          </CardContent>
        </Card>
      )}

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
              className="relative min-h-[200px] cursor-pointer perspective-1000"
              onClick={() => setShowAnswer(!showAnswer)}
            >
              <div
                className={`relative w-full min-h-[200px] transition-transform duration-500 preserve-3d ${
                  showAnswer ? "rotate-y-180" : ""
                }`}
              >
                {/* Front of card (Question) */}
                <div className="absolute inset-0 p-6 rounded-lg bg-muted/50 flex items-center justify-center backface-hidden hover:bg-muted transition-colors">
                  <div className="text-center space-y-4">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Question</p>
                    <p className="text-lg leading-relaxed">{flashcards[currentCardIndex].question}</p>
                    <p className="text-xs text-muted-foreground">Click to reveal answer</p>
                  </div>
                </div>

                {/* Back of card (Answer) */}
                <div className="absolute inset-0 p-6 rounded-lg bg-primary/10 flex items-center justify-center backface-hidden rotate-y-180 hover:bg-primary/20 transition-colors">
                  <div className="text-center space-y-4">
                    <p className="text-sm font-semibold text-primary uppercase tracking-wide">Answer</p>
                    <p className="text-lg leading-relaxed">{flashcards[currentCardIndex].answer}</p>
                    <p className="text-xs text-muted-foreground">Click to hide answer</p>
                  </div>
                </div>
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

function ChatWithPDF({ file, chatRef }: { file: File | null; chatRef: React.RefObject<HTMLDivElement | null> }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [pdfText, setPdfText] = useState<string>("")
  const [blobUrl, setBlobUrl] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Upload large files to blob storage once when component mounts
    if (file && !blobUrl && file.size > 4.5 * 1024 * 1024) {
      const uploadToBlob = async () => {
        try {
          console.log("Uploading PDF to blob for chat...")
          const { upload } = await import("@vercel/blob/client")
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ filename: file.name }),
          })
          setBlobUrl(blob.url)
          console.log("PDF uploaded to blob for chat:", blob.url)
        } catch (error) {
          console.error("Failed to upload PDF to blob:", error)
        }
      }
      uploadToBlob()
    }
  }, [file, blobUrl])

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
      
      // Use blob URL for large files, direct upload for small files
      if (blobUrl) {
        formData.append("blobUrl", blobUrl)
      } else {
        formData.append("pdf", file)
      }
      
      formData.append("question", input)
      if (pdfText) {
        formData.append("pdfText", pdfText)
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes("Resource exhausted") || errorText.includes("RESOURCE_EXHAUSTED")) {
          throw new Error("Rate limit reached. Please wait a moment before asking another question.")
        }
        throw new Error(errorText || "Failed to get response")
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

          const chunk = decoder.decode(value, { stream: true })
          if (chunk) {
            assistantMessage += chunk
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: assistantMessage } : msg
              )
            )
          }
        }
      }

      // If no content was received after streaming is done, show an error
      if (!assistantMessage.trim()) {
        console.error("No content received from AI")
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: "Sorry, I couldn't generate a response. Please try rephrasing your question." }
              : msg
          )
        )
      }
    } catch (error) {
      console.error("Chat error:", error)
      let errorMessage = "Sorry, I encountered an error. Please try again."
      
      if (error instanceof Error) {
        if (error.message.includes("Resource exhausted") || error.message.includes("rate limit")) {
          errorMessage = "Rate limit reached. Please wait a moment before asking another question."
        } else if (error.message.includes("quota")) {
          errorMessage = "API quota exceeded. Please try again later."
        } else {
          errorMessage = error.message
        }
      }
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMessage,
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
        <div className="h-[400px] overflow-y-auto space-y-4 p-6 rounded-xl bg-gradient-to-b from-muted/30 to-muted/50 border border-border/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageCircle className="w-12 h-12 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Start a conversation</p>
                <p className="text-xs text-muted-foreground/70">Ask any question about your PDF document</p>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-background border border-border/50 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-[85%] p-4 rounded-2xl rounded-bl-md bg-background border border-border/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here..."
              className="w-full px-5 py-3 pr-12 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground/50"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="rounded-xl px-6 h-[49.5px]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
