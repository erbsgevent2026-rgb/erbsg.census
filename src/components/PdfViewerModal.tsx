import React, { useState, useEffect, useMemo } from "react";
import { X, Download, ZoomIn, ZoomOut, Maximize2, Minimize2, FileText, Printer, ExternalLink } from "lucide-react";
import { printPdfData } from "../utils/printDocument";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileName: string;
  fileData?: string; // base64 or data URL
  uploadedBy?: string;
  uploadedAt?: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  fileName,
  fileData,
  uploadedBy,
  uploadedAt,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileData) {
      setBlobUrl(null);
      return;
    }

    try {
      const cleanBase64 = fileData.includes(",") ? fileData.split(",")[1] : fileData;
      const cleanNormalized = cleanBase64.replace(/[\s\r\n]+/g, "");
      const byteCharacters = atob(cleanNormalized);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Error creating PDF blob:", err);
      setBlobUrl(null);
    }
  }, [fileData]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!blobUrl && !fileData) return;
    const link = document.createElement("a");
    link.href = blobUrl || (fileData?.startsWith("data:") ? fileData : `data:application/pdf;base64,${fileData}`);
    link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (fileData) {
      printPdfData(fileData, fileName);
    } else if (blobUrl) {
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "1px";
      printFrame.style.height = "1px";
      printFrame.style.opacity = "0.01";
      printFrame.src = blobUrl;
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch {
            window.open(blobUrl, "_blank")?.print();
          }
        }, 400);
      };
    }
  };

  const handleOpenExternal = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen ? "w-full h-full max-w-none rounded-none" : "w-full max-w-5xl h-[88vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {fileName} {uploadedBy ? `• Uploaded by: ${uploadedBy}` : ""} {uploadedAt ? `• ${new Date(uploadedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden md:flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setZoom((z) => Math.max(60, z - 15))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-semibold text-slate-700 dark:text-slate-300 min-w-[2.75rem] text-center text-[11px]">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(180, z + 15))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xs cursor-pointer"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition shadow-xs cursor-pointer"
              title="Print Exact PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {blobUrl && (
              <button
                onClick={handleOpenExternal}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-950 p-3 sm:p-5 overflow-auto flex items-center justify-center">
          {blobUrl ? (
            <div
              className="bg-white shadow-xl rounded-lg border border-slate-300 dark:border-slate-800 transition-all duration-150 flex flex-col items-center justify-center overflow-hidden"
              style={{
                width: `${zoom}%`,
                height: "100%",
                maxWidth: "100%",
              }}
            >
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0 rounded-lg bg-white"
                title={fileName}
              />
            </div>
          ) : (
            <div className="text-center p-8 text-slate-500 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-slate-400" />
              <p className="font-semibold text-sm">Loading PDF document...</p>
              <p className="text-xs text-slate-400">Fetching document data from secure storage.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
