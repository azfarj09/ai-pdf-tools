"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PDFViewerProps {
  fileUrl: string
}

export function PDFViewer({ fileUrl }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<any>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [pageNum, setPageNum] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true)
        setError("")

        // Dynamically import pdfjs-dist
        const pdfjsLib = await import("pdfjs-dist")
        
        // Set worker path using unpkg CDN (more reliable than cdnjs)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const loadingTask = pdfjsLib.getDocument(fileUrl)
        const pdf = await loadingTask.promise

        setPdfDoc(pdf)
        setPageCount(pdf.numPages)
        setLoading(false)
      } catch (err) {
        console.error("Error loading PDF:", err)
        setError("Failed to load PDF. Please try again.")
        setLoading(false)
      }
    }

    loadPDF()
  }, [fileUrl])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const renderPage = async () => {
      try {
        // Cancel any ongoing render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel()
          renderTaskRef.current = null
        }

        const page = await pdfDoc.getPage(pageNum)
        const canvas = canvasRef.current
        if (!canvas) return

        const context = canvas.getContext("2d")
        if (!context) return

        const viewport = page.getViewport({ scale })

        // Set canvas dimensions
        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        // Store the render task so we can cancel it if needed
        renderTaskRef.current = page.render(renderContext)
        
        await renderTaskRef.current.promise
        renderTaskRef.current = null
      } catch (err: any) {
        // Ignore cancellation errors
        if (err?.name === "RenderingCancelledException") {
          return
        }
        console.error("Error rendering page:", err)
        setError("Failed to render page.")
      }
    }

    renderPage()

    // Cleanup function to cancel render on unmount
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNum, scale])

  const goToPrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
    }
  }

  const goToNextPage = () => {
    if (pageNum < pageCount) {
      setPageNum(pageNum + 1)
    }
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px] sm:h-[550px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px] sm:h-[550px]">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={pageNum <= 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 min-w-[80px] text-center">
            {pageNum} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNum >= pageCount}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5} className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3.0} className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="w-full max-h-[400px] sm:max-h-[550px] border rounded-lg overflow-auto bg-muted/30 flex items-start justify-center p-4">
        <canvas ref={canvasRef} className="h-auto" />
      </div>
    </div>
  )
}
