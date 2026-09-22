import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { StatutoryDocument } from "../types";
import { exportToExcel } from "../utils/excelExport";
import { PdfViewerModal } from "../components/PdfViewerModal";
import { printStatutoryDocument, printStatutorySummaryTable } from "../utils/printDocument";
import {
  FileCheck,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Loader2,
  Printer
} from "lucide-react";

export const AuditedStatementsView: React.FC = () => {
  const { user, selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [statements, setStatements] = useState<StatutoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState<string>(selectedYear);
  const [filterDistrict, setFilterDistrict] = useState<string>(isStateAdmin ? "ALL" : user?.districtId || "");

  // Upload Form State
  const [uploadDistrictId, setUploadDistrictId] = useState<string>(user?.districtId || (districts[0]?.id || "dist_asn"));
  const [uploadYearId, setUploadYearId] = useState<string>(selectedYear);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // PDF Viewer Modal State
  const [activePdfDoc, setActivePdfDoc] = useState<StatutoryDocument | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditedStatements();
      setStatements(data);
    } catch (err: any) {
      console.error("Failed to load audited statements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, [syncEventTimestamp]);

  useEffect(() => {
    if (user?.districtId) {
      setUploadDistrictId(user.districtId);
    }
  }, [user]);

  const filteredStatements = useMemo(() => {
    return statements.filter((s) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        s.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.district_name && s.district_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.year_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchYear = filterYear === "ALL" || s.year_id === filterYear;
      const matchDistrict = filterDistrict === "ALL" || s.district_id === filterDistrict;

      return matchSearch && matchYear && matchDistrict;
    });
  }, [statements, searchQuery, filterYear, filterDistrict]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatusMessage({ type: "error", text: "Only PDF files are permitted for Audited Statements." });
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
          const res = await api.uploadAuditedStatement({
            district_id: uploadDistrictId,
            year_id: uploadYearId,
            file_name: uploadFile.name,
            file_size: uploadFile.size,
            file_data: base64Data,
          });

          setStatusMessage({
            type: "success",
            text: `Audited Statement uploaded successfully (Version ${res.version}).`,
          });
          setUploadFile(null);
          await fetchStatements();
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Audited Statement: ${name}?`)) return;
    try {
      await api.deleteAuditedStatement(id);
      setStatusMessage({ type: "success", text: "Audited statement deleted successfully." });
      await fetchStatements();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to delete statement." });
    }
  };

  const handleViewPdf = async (stmt: StatutoryDocument) => {
    try {
      const fullDoc = await api.getAuditedStatementFile(stmt.id);
      setActivePdfDoc(fullDoc);
      setPdfModalOpen(true);
    } catch {
      alert("Failed to load PDF preview.");
    }
  };

  const handleDownloadExcel = () => {
    const rows = filteredStatements.map((s, i) => ({
      "SL No": i + 1,
      "District": s.district_name || s.district_id,
      "File Name": s.file_name,
      "Annual Year": availableYears.find((y) => y.id === s.year_id)?.label || s.year_id,
      "Version": `v${s.version}`,
      "File Size (KB)": Math.round(s.file_size / 1024),
      "Uploaded By": s.uploaded_by,
      "Upload Date": new Date(s.uploaded_at).toLocaleString(),
      "Status": s.status,
    }));
    exportToExcel(rows, `ERBSG_Audited_Statements_${new Date().toISOString().slice(0, 10)}`, "Audited Statements");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Audited Statements</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified financial audit reports and balance sheet records
          </p>
        </div>

        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs self-start md:self-auto transition"
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

      <div className={!isStateAdmin ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "w-full"}>
        {/* Upload Panel - only shown to District Users, removed for State Admin */}
        {!isStateAdmin && (
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upload / Replace Audited Statement
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
                  Select Audited PDF
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="auditedFileInput"
                  />
                  <label htmlFor="auditedFileInput" className="cursor-pointer">
                    <FileCheck className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      {uploadFile ? uploadFile.name : "Choose Audited PDF from computer"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Official CA Certified PDF • Max size: 15 MB
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
                    <span>Uploading Statement...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload / Replace Statement</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Statements Table Panel */}
        <div className={`${!isStateAdmin ? "lg:col-span-2" : "w-full"} bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col`}>
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
                onClick={() => printStatutorySummaryTable(filteredStatements, "Audited Statement", availableYears.find((y) => y.id === filterYear)?.label || filterYear, isStateAdmin)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition"
                title="Print Summary / PDF Register"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print List</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading statements...</div>
            ) : filteredStatements.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No Audited Statements found matching current filters.
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
                  {filteredStatements.map((stmt, idx) => {
                    const yearObj = availableYears.find((y) => y.id === stmt.year_id);
                    return (
                      <tr key={stmt.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                        <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-xs" title={stmt.file_name}>
                              {stmt.file_name}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                              v{stmt.version}
                            </span>
                          </div>
                        </td>
                        {isStateAdmin && (
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-semibold">
                            {stmt.district_name || stmt.district_id}
                          </td>
                        )}
                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {yearObj?.label || stmt.year_id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {stmt.uploaded_by}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {new Date(stmt.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleViewPdf(stmt)}
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 rounded-md transition"
                            title="View Statement"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => printStatutoryDocument(stmt, "Audited Statement", yearObj?.label || stmt.year_id)}
                            className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-md transition"
                            title="Print / Generate PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDelete(stmt.id, stmt.file_name)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition"
                            title="Delete Statement"
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

      {pdfModalOpen && activePdfDoc && (
        <PdfViewerModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          title={`Audited Statement (${availableYears.find((y) => y.id === activePdfDoc.year_id)?.label || activePdfDoc.year_id})`}
          fileName={activePdfDoc.file_name}
          fileData={activePdfDoc.file_data}
          uploadedBy={activePdfDoc.uploaded_by}
          uploadedAt={activePdfDoc.uploaded_at}
        />
      )}
    </div>
  );
};
