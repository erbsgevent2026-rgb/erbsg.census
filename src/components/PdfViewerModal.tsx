import React, { useState } from "react";
import { X, Download, ZoomIn, ZoomOut, Maximize2, Minimize2, FileText, Printer } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileName: string;
  fileData?: string; // base64 or url
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

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!fileData) {
      alert("Document data unavailable for download.");
      return;
    }
    const link = document.createElement("a");
    link.href = fileData.startsWith("data:") ? fileData : `data:application/pdf;base64,${fileData}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!fileData) {
      window.print();
      return;
    }
    const pdfSrc = fileData.startsWith("data:") ? fileData : `data:application/pdf;base64,${fileData}`;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = pdfSrc;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          window.open(pdfSrc, "_blank")?.print();
        }
      }, 400);
    };
  };

  const pdfSrc = fileData
    ? fileData.startsWith("data:")
      ? fileData
      : `data:application/pdf;base64,${fileData}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen ? "w-full h-full max-w-none rounded-none" : "w-full max-w-5xl h-[85vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fileName} {uploadedBy ? `• Uploaded by: ${uploadedBy}` : ""} {uploadedAt ? `(${new Date(uploadedAt).toLocaleDateString()})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-xs">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 15))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors shadow-sm"
              title="Print PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 overflow-auto flex items-center justify-center">
          {pdfSrc ? (
            <div
              className="bg-white shadow-xl rounded border border-slate-300 dark:border-slate-800 transition-all duration-150 origin-top"
              style={{
                width: `${zoom}%`,
                minHeight: "100%",
                maxWidth: "100%",
              }}
            >
              <object
                data={`${pdfSrc}#toolbar=0&navpanes=0`}
                type="application/pdf"
                className="w-full h-[70vh] rounded"
              >
                <div className="p-8 text-center text-slate-600 dark:text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="font-semibold text-base mb-1">Official Document Preview</p>
                  <p className="text-sm mb-4">
                    Browser preview is active. You can also download the verified PDF directly.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow"
                  >
                    Download {fileName}
                  </button>
                </div>
              </object>
            </div>
          ) : (
            <div className="text-center p-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-400" />
              <p>No document preview available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
