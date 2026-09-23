import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  Users,
  Building2,
  FileText,
  FileSpreadsheet,
  FileCheck,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Download,
  BarChart3
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";
import { exportToExcel } from "../utils/excelExport";
import { MemberGrowthChart } from "../components/MemberGrowthChart";

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, selectedYear, availableYears, syncEventTimestamp } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentYearLabel =
    availableYears.find((y) => y.id === selectedYear)?.label || "2026-2027";

  const fetchStats = async () => {
    if (user?.mustChangePassword) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getDashboardStats(selectedYear);
      setStats(data);
    } catch (err: any) {
      if (err?.message?.includes("Password change required")) {
        setLoading(false);
        return;
      }
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.mustChangePassword) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [selectedYear, syncEventTimestamp, user?.mustChangePassword]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading live ERBSG portal statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const isStateAdmin = user?.role === "STATE_ADMIN";

  // Chart data for State Admin: Horizontal Bar of all 8 districts
  const districtChartData = (stats.districtBreakdown || []).map((d: any) => ({
    name: d.district_name.replace(" District", ""),
    fullName: d.district_name,
    youth: d.youth_total,
    leaders: d.unit_leaders_total,
    staff: d.professionals_total,
    total: d.grand_total,
    arStatus: d.has_annual_report ? "Uploaded" : "Pending",
    crStatus: d.has_census_report ? "Uploaded" : "Pending",
    asStatus: d.has_audited_statement ? "Uploaded" : "Pending",
    contactStatus: d.has_official_contacts ? "Selected" : "Missing",
  }));

  // Dynamic Member Growth Statistics calculated directly from the database by academic year
  const growthData = Array.isArray(stats.growthStatistics) ? stats.growthStatistics : [];

  const handleExportSummary = () => {
    if (isStateAdmin && stats.districtBreakdown) {
      const rows = stats.districtBreakdown.map((d: any) => ({
        "District Name": d.district_name,
        "District Code": d.district_code,
        "Youth Members": d.youth_total,
        "Unit Leaders": d.unit_leaders_total,
        "Professionals / Staff": d.professionals_total,
        "Grand Total": d.grand_total,
        "Annual Report": d.has_annual_report ? "Submitted" : "Pending",
        "Census Report": d.has_census_report ? "Submitted" : "Pending",
        "Audited Statement": d.has_audited_statement ? "Submitted" : "Pending",
        "Official Contacts": d.has_official_contacts ? "Configured" : "Pending",
      }));
      exportToExcel(rows, `ERBSG_District_Summary_${currentYearLabel}`, "State Summary");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          {isStateAdmin ? (
            <>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Eastern Railway State Overview
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Centralized Census Statistics, Compliance and Statutory Reports of the Districts over Eastern Railway State
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  District Headquarters
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Academic Session {currentYearLabel}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {stats.district?.name || user?.districtName || "District"} Control Dashboard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official data reporting for {user?.bsgId} • Eastern Railway Bharat Scouts and Guides.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isStateAdmin && (
            <button
              onClick={handleExportSummary}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Export State Excel</span>
            </button>
          )}

          <button
            onClick={() => onNavigate("members")}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition shadow-xs"
          >
            <Users className="w-4 h-4" />
            <span>Manage Census</span>
          </button>
        </div>
      </div>

      {/* STATE ADMIN VIEW */}
      {isStateAdmin ? (
        <>
          {/* Prominent Reports & Analytics Section at Top of Admin Dashboard */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-700 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Reports & Analytics
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comparative census distribution and registered category strength across all 8 districts
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportSummary}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Analytics</span>
              </button>
            </div>

            {/* Visual Analytics Chart */}
            <div className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  District Registered Strength by Category
                </h4>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 font-semibold text-blue-600">
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs"></span> Youth
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-purple-600">
                    <span className="w-2.5 h-2.5 bg-purple-600 rounded-xs"></span> Leaders
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs"></span> Staff
                  </span>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={districtChartData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        color: "#fff",
                        borderRadius: "0.5rem",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="youth" name="Youth Strength" stackId="a" fill="#2563eb" />
                    <Bar dataKey="leaders" name="Unit Leaders" stackId="a" fill="#9333ea" />
                    <Bar dataKey="staff" name="Professionals & Staff" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Member Growth Statistics (Recharts Longitudinal Visualization) */}
          <MemberGrowthChart
            data={growthData}
            title="Eastern Railway State Member Growth Statistics"
            subtitle="Year-wise total registered membership and year-over-year growth trajectory across Eastern Railway"
            currentYearLabel={currentYearLabel}
            scope="state"
          />

          {/* Top Statistic Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Districts
                </span>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.totalDistricts}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {stats.activeDistricts} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{stats.totalDistricts || 9} Core Divisions & Workshops in Eastern Railway</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Registered Members
                </span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.totalMembers.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  State-Wide
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Combined Census ({currentYearLabel})</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Youth Strength
                </span>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.youthMembership.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {stats.totalMembers ? Math.round((stats.youthMembership / stats.totalMembers) * 100) : 0}% of Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cubs, Bulbuls, Scouts, Guides, Rovers, Rangers</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unit Leaders & Staff
                </span>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {(stats.unitLeaders + stats.professionals).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  {stats.unitLeaders} Leaders / {stats.professionals} Staff
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Qualified Scouters, Guiders & Commissioners</p>
            </div>
          </div>

          {/* Statutory Documents Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Annual Reports Compliance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats.annualReportsUploaded} of {stats.totalDistricts} Districts Uploaded
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width: `${(stats.annualReportsUploaded / Math.max(stats.totalDistricts, 1)) * 100}%`,
                    }}
                  ></div>
                </div>
                <button
                  onClick={() => onNavigate("annual-reports")}
                  className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Census Reports Compliance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats.censusReportsUploaded || 0} of {stats.totalDistricts} Districts Uploaded
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2.5 rounded-full"
                    style={{
                      width: `${((stats.censusReportsUploaded || 0) / Math.max(stats.totalDistricts, 1)) * 100}%`,
                    }}
                  ></div>
                </div>
                <button
                  onClick={() => onNavigate("census-reports")}
                  className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Audited Statements Compliance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats.auditedStatementsUploaded} of {stats.totalDistricts} Districts Uploaded
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full"
                    style={{
                      width: `${(stats.auditedStatementsUploaded / Math.max(stats.totalDistricts, 1)) * 100}%`,
                    }}
                  ></div>
                </div>
                <button
                  onClick={() => onNavigate("audited-statements")}
                  className="p-1 text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Submission Progress Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  District Statutory Submission Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time submission monitoring across all {stats.totalDistricts || 9} districts for {currentYearLabel}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3 text-right">Total Members</th>
                    <th className="px-4 py-3 text-center">Annual Report</th>
                    <th className="px-4 py-3 text-center">Census Report</th>
                    <th className="px-4 py-3 text-center">Audited Statement</th>
                    <th className="px-4 py-3 text-center">Official Contacts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                  {(stats.districtBreakdown || []).map((row: any, idx: number) => (
                    <tr key={`${row.district_id || "dist"}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {row.district_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{row.district_code}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {row.grand_total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.has_annual_report ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.has_census_report ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.has_audited_statement ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.has_official_contacts ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* DISTRICT USER VIEW */
        <>
          {/* Top District Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Youth Total
                </span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {stats.membership?.youth_total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Cubs, Scouts, Guides, Rovers, Rangers, Bulbuls</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unit Leaders
                </span>
                <UserCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {stats.membership?.unit_leaders_total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Captains, Masters, Flock & Ranger Leaders</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total District Strength
                </span>
                <Building2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {stats.membership?.grand_total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total registered members for {currentYearLabel}</p>
            </div>
          </div>

          {/* Member Growth Statistics for District */}
          <MemberGrowthChart
            data={growthData}
            title={`${stats.district?.name || "District"} Member Growth Statistics`}
            subtitle={`Year-wise total registered membership and year-over-year growth trajectory for ${stats.district?.name || "this district"}`}
            currentYearLabel={currentYearLabel}
            scope="district"
          />

          {/* Detailed Youth Membership Breakdown */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Youth Membership Strength Breakdown
            </h3>
            <p className="text-xs text-slate-500 mb-4">Official category counts registered for {stats.district?.name}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Scouts", count: stats.membership?.scout || 0, color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
                { label: "Guides", count: stats.membership?.guide || 0, color: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" },
                { label: "Cubs", count: stats.membership?.cub || 0, color: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
                { label: "Bulbuls", count: stats.membership?.bulbul || 0, color: "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" },
                { label: "Rovers", count: stats.membership?.rover || 0, color: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
                { label: "Rangers", count: stats.membership?.ranger || 0, color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
              ].map((item) => (
                <div key={item.label} className={`p-3 rounded-xl border border-slate-100 dark:border-slate-700 ${item.color} text-center`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-black mt-1">{item.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Submission Checklist for District User */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Statutory Submission Status Checklist
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Annual Report</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stats.documents?.annualReport ? stats.documents.annualReport.file_name : "Not yet uploaded"}
                  </p>
                  <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.documents?.annualReport ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                    {stats.documents?.annualReport ? "✓ Completed" : "! Pending Upload"}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("annual-reports")}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Census Report</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stats.documents?.censusReport ? stats.documents.censusReport.file_name : "Not yet uploaded"}
                  </p>
                  <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.documents?.censusReport ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                    {stats.documents?.censusReport ? "✓ Completed" : "! Pending Upload"}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("census-reports")}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Audited Statement</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stats.documents?.auditedStatement ? stats.documents.auditedStatement.file_name : "Not yet uploaded"}
                  </p>
                  <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.documents?.auditedStatement ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                    {stats.documents?.auditedStatement ? "✓ Completed" : "! Pending Upload"}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("audited-statements")}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Official Contacts</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stats.documents?.officialContactsCount} Contact Persons Configured
                  </p>
                  <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.documents?.officialContactsCount > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                    {stats.documents?.officialContactsCount > 0 ? "✓ Configured" : "! Action Needed"}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("official-contacts")}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
