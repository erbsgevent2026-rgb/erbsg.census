import React, { useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  LineChart as LineChartIcon,
  Users,
  Activity
} from "lucide-react";

export interface GrowthDataPoint {
  yearId?: string;
  year: string;
  fullYear: string;
  total: number;
  growthRate: string;
  growthPercent?: number | null;
  isBaseline?: boolean;
  isLive?: boolean;
}

interface MemberGrowthChartProps {
  data: GrowthDataPoint[];
  title?: string;
  subtitle?: string;
  currentYearLabel?: string;
  scope?: "state" | "district";
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload as GrowthDataPoint;
    const isBaseline = item.isBaseline || item.growthRate === "Baseline";
    const isDecline =
      (item.growthPercent !== null && item.growthPercent !== undefined && item.growthPercent < 0) ||
      (item.growthRate && item.growthRate.startsWith("-"));

    return (
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs text-white p-3.5 rounded-xl border border-slate-700/80 shadow-xl text-xs space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/70">
          <span className="font-bold text-slate-200">
            {item.fullYear || item.year}
          </span>
          {item.isLive && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Active Session
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Total Membership:
          </span>
          <span className="font-black text-white text-sm">
            {Number(item.total).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-400">YoY Change:</span>
          {isBaseline ? (
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Baseline
            </span>
          ) : isDecline ? (
            <span className="inline-flex items-center gap-1 font-bold text-rose-400 text-xs bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/50">
              <TrendingDown className="w-3 h-3" />
              {item.growthRate}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-xs bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
              <TrendingUp className="w-3 h-3" />
              {item.growthRate}
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const MemberGrowthChart: React.FC<MemberGrowthChartProps> = ({
  data,
  title = "Eastern Railway State Member Growth Statistics",
  subtitle = "Year-wise total registered membership and year-over-year growth trajectory",
  currentYearLabel = "2026-2027",
  scope = "state"
}) => {
  const [chartType, setChartType] = useState<"area" | "line">("area");

  const validData = Array.isArray(data) ? data : [];
  const initialPoint = validData[0];
  const latestPoint = validData[validData.length - 1];

  // Calculate overall net growth from baseline to latest session
  const netGrowthPercent =
    initialPoint && latestPoint && initialPoint.total > 0
      ? Number((((latestPoint.total - initialPoint.total) / initialPoint.total) * 100).toFixed(1))
      : null;

  const isOverallDecline = netGrowthPercent !== null && netGrowthPercent < 0;

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
      {/* Header with Title, Trend Indicator, and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
              isOverallDecline
                ? "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                : "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
            }`}
          >
            {isOverallDecline ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              {netGrowthPercent !== null && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isOverallDecline
                      ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {netGrowthPercent >= 0 ? `+${netGrowthPercent}%` : `${netGrowthPercent}%`} Net Change
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Line / Area Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-slate-100 dark:bg-slate-700/70 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <button
              onClick={() => setChartType("area")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                chartType === "area"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Area Trend View"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                chartType === "line"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Line Chart View"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Year-Wise Membership Growth Chart */}
      <div className="h-72 w-full">
        {validData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            No dynamic census records available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart
                data={validData}
                margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="membershipGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(val) => Number(val).toLocaleString()}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total Membership"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#membershipGrowthGrad)"
                  dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                />
              </AreaChart>
            ) : (
              <LineChart
                data={validData}
                margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(val) => Number(val).toLocaleString()}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Membership"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Year-by-Year Membership & YoY Increase / Decrease Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
        {validData.map((item, index) => {
          const isBaseline = index === 0 || item.isBaseline || item.growthRate === "Baseline";
          const isDecline =
            (item.growthPercent !== null && item.growthPercent !== undefined && item.growthPercent < 0) ||
            (item.growthRate && item.growthRate.startsWith("-"));

          return (
            <div
              key={item.yearId || item.year}
              className={`p-3 rounded-xl border transition ${
                item.isLive
                  ? "bg-blue-50/70 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-400/50"
                  : "bg-slate-50/80 dark:bg-slate-850/80 border-slate-200 dark:border-slate-750"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {item.year}
                </span>
                {item.isLive && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                    title="Active Census Year"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              <div className="text-lg font-black text-slate-900 dark:text-white">
                {Number(item.total).toLocaleString()}
              </div>

              <div className="mt-1.5 flex items-center">
                {isBaseline ? (
                  <span className="inline-block text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 px-2 py-0.5 rounded">
                    Baseline
                  </span>
                ) : isDecline ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                    <TrendingDown className="w-3 h-3" />
                    {item.growthRate}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40">
                    <TrendingUp className="w-3 h-3" />
                    {item.growthRate}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
