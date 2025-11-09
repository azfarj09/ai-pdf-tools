"use client"

import type React from "react"

import { useState } from "react"
import { FileText, Sparkles, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)

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
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile)
        setError("")
      } else {
        setError("Please upload a PDF file")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile)
        setError("")
      } else {
        setError("Please upload a PDF file")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a PDF file")
      return
    }

    setLoading(true)
    setError("")
    setSummary("")

    try {
      const formData = new FormData()
      formData.append("pdf", file)

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to summarize PDF")
      }

      const data = await response.json()
      console.log("API Response:", data)
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

  const handleReset = () => {
    setFile(null)
    setSummary("")
    setError("")
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <Sparkles className="w-10 h-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">PDF Summarizer</h1>
        </div>
        <p className="max-w-xl text-lg text-muted-foreground text-balance">
          Upload any PDF document and receive a clean, AI-powered summary in seconds
        </p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Select or drag and drop your PDF file to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              {(file || summary) && (
                <Button type="button" variant="outline" onClick={handleReset} disabled={loading}>
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {summary && (
        <Card className="w-full max-w-2xl">
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
    </main>
  )
}
