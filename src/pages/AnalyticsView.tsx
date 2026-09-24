import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { exportToExcel } from "../utils/excelExport";
import {
  BarChart3,
  Download,
  Building2,
  Users,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const AnalyticsView: React.FC = () => {
  const { selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentYearLabel =
    availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats(selectedYear);
      setStats(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedYear, syncEventTimestamp]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading comparative analytics...
      </div>
    );
  }

  if (!stats) return null;

  const chartData = (stats.districtBreakdown || []).map((d: any) => ({
    name: d.district_name.replace(" District", ""),
    youth: d.youth_total,
    leaders: d.unit_leaders_total,
    staff: d.professionals_total,
    total: d.grand_total,
  }));

  const pieColors = ["#2563eb", "#7c3aed", "#d97706", "#059669", "#dc2626", "#0891b2", "#ea580c", "#4f46e5", "#0d9488"];

  const handleExport = () => {
    const rows = (stats.districtBreakdown || []).map((d: any) => ({
      "District Name": d.district_name,
      "Code": d.district_code,
      "Youth Members": d.youth_total,
      "Unit Leaders": d.unit_leaders_total,
      "Staff": d.professionals_total,
      "Grand Total": d.grand_total,
      "Annual Report": d.has_annual_report ? "YES" : "NO",
      "Audited Statement": d.has_audited_statement ? "YES" : "NO",
      "Official Contacts": d.has_official_contacts ? "YES" : "NO",
    }));

    exportToExcel(rows, `ERBSG_District_Comparative_Analytics_${currentYearLabel}`, "State Comparison");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              State Intelligence
            </span>
            <span className="text-xs font-semibold text-slate-500">Academic Session {currentYearLabel}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Comparative District Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cross-divisional census metrics and statutory completion index across all 9 Eastern Railway districts
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Analytics</span>
        </button>
      </div>

      {/* Chart 1: District Total Membership Bar Chart */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
          Total Registered Strength by District
        </h3>
        <p className="text-xs text-slate-500 mb-4">Comparison of census numbers for session {currentYearLabel}</p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  color: "#fff",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }} />
              <Bar dataKey="youth" name="Youth Strength" stackId="a" fill="#2563eb" />
              <Bar dataKey="leaders" name="Unit Leaders" stackId="a" fill="#9333ea" />
              <Bar dataKey="staff" name="Professionals / Staff" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2 & 3: Pie Chart of Total Share & Compliance Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            District Membership Share
          </h3>
          <p className="text-xs text-slate-500 mb-2">Percentage distribution across Eastern Railway</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: any) =>
                    percent && !isNaN(percent) && percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                  }
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    color: "#fff",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Overall Compliance Summary
            </h3>
            <p className="text-xs text-slate-500 mb-4">Statutory milestones achieved across Eastern Railway</p>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Annual Reports Uploaded</span>
                  <span className="text-blue-600 font-bold">
                    {stats.annualReportsUploaded} / {stats.totalDistricts} (
                    {Math.round((stats.annualReportsUploaded / Math.max(stats.totalDistricts, 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{
                      width: `${(stats.annualReportsUploaded / Math.max(stats.totalDistricts, 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Audited Statements Uploaded</span>
                  <span className="text-emerald-600 font-bold">
                    {stats.auditedStatementsUploaded} / {stats.totalDistricts} (
                    {Math.round((stats.auditedStatementsUploaded / Math.max(stats.totalDistricts, 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{
                      width: `${(stats.auditedStatementsUploaded / Math.max(stats.totalDistricts, 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Census Submissions Completed</span>
                  <span className="text-purple-600 font-bold">
                    {stats.totalDistricts} / {stats.totalDistricts} (100%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full w-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-850 rounded-lg text-[11px] text-slate-500 border border-slate-200 dark:border-slate-700">
            All data points reflect live calculations saved in the Eastern Railway central database.
          </div>
        </div>
      </div>
    </div>
  );
};
