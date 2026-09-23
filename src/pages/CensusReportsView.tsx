import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { StatutoryDocument } from "../types";
import { exportToExcel } from "../utils/excelExport";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { printStatutoryDocument, printStatutorySummaryTable, printPdfData } from "../utils/printDocument";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer
} from "lucide-react";

export const CensusReportsView: React.FC = () => {
  const { user, selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [reports, setReports] = useState<StatutoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState<string>(selectedYear);
  const [filterDistrict, setFilterDistrict] = useState<string>(isStateAdmin ? "ALL" : user?.districtId || "");

  // Upload Form State (for District Users)
  const [uploadDistrictId, setUploadDistrictId] = useState<string>(user?.districtId || (districts[0]?.id || "dist_asn"));
  const [uploadYearId, setUploadYearId] = useState<string>(selectedYear);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // PDF Viewer Modal State
  const [activePdfDoc, setActivePdfDoc] = useState<StatutoryDocument | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Delete Modal State
  const [documentToDelete, setDocumentToDelete] = useState<StatutoryDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await api.getCensusReports();
      setReports(data);
    } catch (err: any) {
      console.error("Failed to load census reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [syncEventTimestamp]);

  useEffect(() => {
    if (user?.districtId) {
      setUploadDistrictId(user.districtId);
    }
  }, [user]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        r.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.district_name && r.district_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.year_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.uploaded_by.toLowerCase().includes(searchQuery.toLowerCase());

      const matchYear = filterYear === "ALL" || r.year_id === filterYear;
      const matchDistrict = filterDistrict === "ALL" || r.district_id === filterDistrict;

      return matchSearch && matchYear && matchDistrict;
    });
  }, [reports, searchQuery, filterYear, filterDistrict]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatusMessage({ type: "error", text: "Only PDF files are permitted for Census Reports." });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "File size exceeds the 15 MB limit." });
      return;
    }

    setUploadFile(file);
    setStatusMessage(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setStatusMessage({ type: "error", text: "Please select a PDF document to upload." });
      return;
    }

    setUploading(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await api.uploadCensusReport({
            district_id: uploadDistrictId,
            year_id: uploadYearId,
            file_name: uploadFile.name,
            file_size: uploadFile.size,
            file_data: base64Data,
          });

          setStatusMessage({
            type: "success",
            text: `Census Report uploaded successfully (Version ${res.version}).`,
          });
          setUploadFile(null);
          await fetchReports();
        } catch (err: any) {
          setStatusMessage({ type: "error", text: err.message || "Failed to upload document." });
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(uploadFile);
    } catch {
      setUploading(false);
      setStatusMessage({ type: "error", text: "Failed to read file." });
    }
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    try {
      setDeleting(true);
      await api.deleteCensusReport(documentToDelete.id);
      // Immediately remove from table state
      setReports((prev) => prev.filter((r) => r.id !== documentToDelete.id));
      setStatusMessage({ type: "success", text: `Census Report "${documentToDelete.file_name}" deleted successfully.` });
      setDocumentToDelete(null);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to delete report." });
    } finally {
      setDeleting(false);
    }
  };

  const handleViewPdf = async (report: StatutoryDocument) => {
    try {
      let fullDoc = report;
      if (!report.file_data) {
        fullDoc = await api.getCensusReportFile(report.id);
      }
      setActivePdfDoc(fullDoc);
      setPdfModalOpen(true);
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load PDF preview." });
    }
  };

  const handlePrintPdf = async (report: StatutoryDocument) => {
    try {
      let fileData = report.file_data;
      if (!fileData) {
        const full = await api.getCensusReportFile(report.id);
        fileData = full.file_data;
      }
      if (!fileData) {
        setStatusMessage({ type: "error", text: "PDF document data is unavailable for printing." });
        return;
      }
      printPdfData(fileData, report.file_name);
    } catch {
      setStatusMessage({ type: "error", text: "Failed to prepare PDF document for printing." });
    }
  };

  const handleDownloadExcel = () => {
    const rows = filteredReports.map((r, i) => ({
      "SL No": i + 1,
      "District": r.district_name || r.district_id,
      "File Name": r.file_name,
      "Annual Year": availableYears.find((y) => y.id === r.year_id)?.label || r.year_id,
      "Version": `v${r.version}`,
      "File Size (KB)": Math.round(r.file_size / 1024),
      "Uploaded By": r.uploaded_by,
      "Upload Date": new Date(r.uploaded_at).toLocaleString(),
      "Status": r.status,
    }));
    exportToExcel(rows, `ERBSG_Census_Reports_${new Date().toISOString().slice(0, 10)}`, "Census Reports");
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Census Reports</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Official statutory census membership report submission, verification, and archive
          </p>
        </div>

        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs self-start md:self-auto transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Excel</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className={!isStateAdmin ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "w-full"}>
        {/* Upload / Replace Panel - shown to District Users and State Admin when managing a district */}
        {!isStateAdmin && (
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upload / Replace Census Report
              </h3>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Session Year
                </label>
                <select
                  value={uploadYearId}
                  onChange={(e) => setUploadYearId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr.id} value={yr.id}>
                      {yr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select PDF Document
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="censusReportFileInput"
                  />
                  <label htmlFor="censusReportFileInput" className="cursor-pointer">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">
                      {uploadFile ? uploadFile.name : "Choose PDF from computer"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      PDF format only • Max file size: 15 MB
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading PDF...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload / Replace PDF</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Reports Table Panel */}
        <div className={`${!isStateAdmin ? "lg:col-span-2" : "w-full"} bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col`}>
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search file name, year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              >
                <option value="ALL">All Years</option>
                {availableYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>

              {isStateAdmin && (
                <select
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="ALL">All Districts</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => printStatutorySummaryTable(filteredReports, "Census Report", availableYears.find((y) => y.id === filterYear)?.label || filterYear, isStateAdmin)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition cursor-pointer"
                title="Print Summary / PDF Register"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print List</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading census reports...</div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No Census Reports found matching current filters.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">SL NO</th>
                    <th className="px-3 py-2.5">FILE NAME</th>
                    {isStateAdmin && <th className="px-3 py-2.5">DISTRICT</th>}
                    <th className="px-3 py-2.5">ANNUAL YEAR</th>
                    <th className="px-3 py-2.5">UPLOADED BY</th>
                    <th className="px-3 py-2.5">UPLOAD DATE</th>
                    <th className="px-3 py-2.5 text-center">VIEW</th>
                    <th className="px-3 py-2.5 text-center">PRINT</th>
                    <th className="px-3 py-2.5 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                  {filteredReports.map((report, idx) => {
                    const yearObj = availableYears.find((y) => y.id === report.year_id);
                    return (
                      <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                        <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-xs" title={report.file_name}>
                              {report.file_name}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                              v{report.version}
                            </span>
                          </div>
                        </td>
                        {isStateAdmin && (
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-semibold">
                            {report.district_name || report.district_id}
                          </td>
                        )}
                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {yearObj?.label || report.year_id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {report.uploaded_by}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {new Date(report.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleViewPdf(report)}
                            className="p-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 rounded-md transition cursor-pointer"
                            title="View Exact PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handlePrintPdf(report)}
                            className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-md transition cursor-pointer"
                            title="Print Exact PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => setDocumentToDelete(report)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition cursor-pointer"
                            title="Delete Report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfModalOpen && activePdfDoc && (
        <PdfViewerModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          title={`Census Report (${availableYears.find((y) => y.id === activePdfDoc.year_id)?.label || activePdfDoc.year_id})`}
          fileName={activePdfDoc.file_name}
          fileData={activePdfDoc.file_data}
          uploadedBy={activePdfDoc.uploaded_by}
          uploadedAt={activePdfDoc.uploaded_at}
        />
      )}

      {/* In-App Delete Confirmation Modal */}
      {documentToDelete && (
        <DeleteConfirmationModal
          isOpen={!!documentToDelete}
          onClose={() => setDocumentToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Census Report"
          fileName={documentToDelete.file_name}
          itemType="Census Report"
          loading={deleting}
        />
      )}
    </div>
  );
};
