"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { PieChart as EChartsPieChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PortfolioSummary, PositionWithRelations, SummaryByDimension } from "@/lib/types";

echarts.use([EChartsPieChart, TooltipComponent, LegendComponent, LabelLayout, CanvasRenderer]);

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatAum(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatUsdK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

type Dimension = "sector" | "industry" | "theme" | "riskCountry" | "gicIndustry" | "exchangeCountry";

const DIM_TABS: { key: Dimension; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "theme", label: "Theme" },
  { key: "riskCountry", label: "Risk Country" },
  { key: "gicIndustry", label: "GIC Industry" },
  { key: "exchangeCountry", label: "Exchange Country" },
];

// Harmonious color palette for pie charts
const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#d946ef", "#22d3ee",
  "#a3e635", "#fb923c", "#a78bfa", "#2dd4bf", "#fbbf24",
];

function DimensionTabs({ current, onChange }: { current: Dimension; onChange: (d: Dimension) => void }) {
  return (
    <div className="flex gap-1">
      {DIM_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-2.5 py-0.5 text-xs rounded-md transition-colors ${current === tab.key
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function getDimData(summary: PortfolioSummary, dim: Dimension): SummaryByDimension[] {
  if (dim === "sector") return summary.bySector;
  if (dim === "industry") return summary.byIndustry;
  if (dim === "theme") return summary.byTheme;
  if (dim === "riskCountry") return summary.byRiskCountry;
  if (dim === "gicIndustry") return summary.byGicIndustry;
  return summary.byExchangeCountry;
}

function getDimValue(p: PositionWithRelations, dim: Dimension): string {
  if (dim === "sector") return p.market || "其他";
  if (dim === "industry") return p.sector?.name || "其他";
  if (dim === "theme") return p.topdown?.name || "Others";
  if (dim === "riskCountry") return p.market || "其他";
  if (dim === "gicIndustry") return p.gicIndustry || "其他";
  return p.exchangeCountry || "其他";
}

// ECharts pie component
function EChartsPie({ data, formatter }: { data: { name: string; value: number }[]; formatter?: (value: number) => string }) {
  const option = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const pct = params.percent.toFixed(1);
        const val = formatter ? formatter(params.value) : `${params.value}%`;
        return `<b>${params.name}</b><br/>${val} (${pct}%)`;
      },
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: { fontSize: 11 },
      formatter: (name: string) => name.length > 14 ? name.slice(0, 14) + "\u2026" : name,
    },
    series: [{
      type: "pie",
      radius: ["25%", "60%"],
      center: ["35%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
      label: {
        show: true,
        formatter: (params: any) => {
          if (params.percent < 3) return "";
          const val = formatter ? formatter(params.value) : `${params.value}%`;
          return `{name|${params.name}}\n{val|${val}}`;
        },
        rich: {
          name: { fontSize: 11, color: "#333" },
          val: { fontSize: 10, color: "#999", lineHeight: 16 },
        },
      },
      labelLine: { show: true, length: 8, length2: 12 },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: "bold" },
        itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.15)" },
      },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] } })),
    }],
  };
  return (
    <ReactEChartsCore echarts={echarts} option={option}
      style={{ height: 300, width: "100%" }} opts={{ renderer: "canvas" }} notMerge={true} />
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // NET/GMV dimension
  const [netDim, setNetDim] = useState<Dimension>("riskCountry");
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [gmvDim, setGmvDim] = useState<Dimension>("riskCountry");
  const [selectedGmvBar, setSelectedGmvBar] = useState<string | null>(null);

  // Pie chart dimension
  const [netPieDim, setNetPieDim] = useState<Dimension>("riskCountry");
  const [gmvPieDim, setGmvPieDim] = useState<Dimension>("riskCountry");

  // PNL dimension
  const [pnlDim, setPnlDim] = useState<Dimension>("riskCountry");
  const [pnlPieDim, setPnlPieDim] = useState<Dimension>("riskCountry");

  const [editingAum, setEditingAum] = useState(false);
  const [aumInput, setAumInput] = useState("");

  function refreshData() {
    Promise.all([
      fetch("/api/summary").then((r) => r.json()),
      fetch("/api/positions").then((r) => r.json()),
    ]).then(([sum, pos]) => {
      setSummary(sum);
      setPositions(pos);
    });
  }

  useEffect(() => {
    refreshData();
    setLoading(false);
  }, []);

  async function saveAum() {
    const val = parseFloat(aumInput);
    if (!val || val <= 0) { setEditingAum(false); return; }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aum: val }),
    });
    setEditingAum(false);
    refreshData();
  }

  // Reset selection when dimension changes
  useEffect(() => { setSelectedBar(null); }, [netDim]);
  useEffect(() => { setSelectedGmvBar(null); }, [gmvDim]);

  // ===== NET data =====
  const netData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, netDim)
      .filter((d) => Math.abs(d.nmv) > 0.001)
      .sort((a, b) => b.nmv - a.nmv)
      .map((d) => ({
        name: d.name,
        nmv: +(d.nmv * 100).toFixed(1),
        long: +(d.long * 100).toFixed(1),
        short: +(d.short * 100).toFixed(1),
      }));
  }, [summary, netDim]);

  // ===== GMV data =====
  const gmvData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, gmvDim)
      .filter((d) => Math.abs(d.gmv) > 0.001)
      .sort((a, b) => b.gmv - a.gmv)
      .map((d) => ({
        name: d.name,
        gmv: +(d.gmv * 100).toFixed(1),
        long: +(d.long * 100).toFixed(1),
        short: +(d.short * 100).toFixed(1),
      }));
  }, [summary, gmvDim]);

  // ===== PNL data =====
  const pnlData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, pnlDim)
      .filter((d) => Math.abs(d.pnl) > 0.01)
      .sort((a, b) => b.pnl - a.pnl)
      .map((d) => ({
        name: d.name,
        pnl: Math.round(d.pnl),
      }));
  }, [summary, pnlDim]);

  // ===== PIE data =====
  const netPieData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, netPieDim)
      .filter(d => d.gmv > 0.001)
      .sort((a, b) => b.gmv - a.gmv)
      .map(d => ({ name: d.name, value: +(Math.abs(d.nmv) * 100).toFixed(1) }));
  }, [summary, netPieDim]);

  const gmvPieData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, gmvPieDim)
      .filter(d => d.gmv > 0.001)
      .sort((a, b) => b.gmv - a.gmv)
      .map(d => ({ name: d.name, value: +(d.gmv * 100).toFixed(1) }));
  }, [summary, gmvPieDim]);

  const pnlPieData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, pnlPieDim)
      .filter(d => Math.abs(d.pnl) > 0.01)
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .map(d => ({ name: d.name, value: Math.round(Math.abs(d.pnl)) }));
  }, [summary, pnlPieDim]);

  // ===== Drill-down for NET =====
  const drillPositions = useMemo(() => {
    if (!selectedBar) return [];
    const active = positions.filter((p) => p.longShort === "long" || p.longShort === "short");
    return active
      .filter((p) => getDimValue(p, netDim) === selectedBar)
      .sort((a, b) => {
        if (a.longShort !== b.longShort) return a.longShort === "long" ? -1 : 1;
        return b.positionAmount - a.positionAmount;
      });
  }, [selectedBar, positions, netDim]);

  // ===== Drill-down for GMV =====
  const drillGmvPositions = useMemo(() => {
    if (!selectedGmvBar) return [];
    const active = positions.filter((p) => p.longShort === "long" || p.longShort === "short");
    return active
      .filter((p) => getDimValue(p, gmvDim) === selectedGmvBar)
      .sort((a, b) => Math.abs(b.positionAmount) - Math.abs(a.positionAmount));
  }, [selectedGmvBar, positions, gmvDim]);

  // ===== Calculate max Y-axis label width =====
  function calcYAxisWidth(data: { name: string }[]) {
    if (data.length === 0) return 60;
    const maxLen = Math.max(...data.map(d => d.name.length));
    return Math.min(Math.max(maxLen * 7, 60), 160);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Failed to load portfolio summary.
      </div>
    );
  }

  const statCards = [
    { label: "AUM", value: formatAum(summary.aum), sub: `${summary.longCount}L / ${summary.shortCount}S / ${summary.watchlistCount}W` },
    { label: "NMV%", value: formatPct(summary.nmv), color: summary.nmv >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "GMV%", value: formatPct(summary.gmv), color: "text-blue-600" },
    { label: "Long%", value: formatPct(summary.totalLong), color: "text-emerald-600" },
    { label: "Short%", value: formatPct(summary.totalShort), color: "text-rose-600" },
    { label: "PNL", value: formatUsdK(summary.totalPnl || 0), color: (summary.totalPnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600" },
  ];

  const longPositions = positions
    .filter((p) => p.longShort === "long")
    .sort((a, b) => b.positionAmount - a.positionAmount)
    .slice(0, 10);

  const shortPositions = positions
    .filter((p) => p.longShort === "short")
    .sort((a, b) => b.positionAmount - a.positionAmount)
    .slice(0, 10);

  function handleNetBarClick(data: { name: string }) {
    setSelectedBar((prev) => (prev === data.name ? null : data.name));
  }
  function handleGmvBarClick(data: { name: string }) {
    setSelectedGmvBar((prev) => (prev === data.name ? null : data.name));
  }

  // Drill-down table component
  function DrillTable({ selected, data, onClose }: { selected: string; data: PositionWithRelations[]; onClose: () => void }) {
    return (
      <div className="mt-2 mb-2 mx-2 border rounded-md">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
          <span className="text-xs font-medium">{selected} — {data.length} 个持仓</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">无持仓</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 text-xs">Company</TableHead>
                <TableHead className="px-2 text-xs">Ticker</TableHead>
                <TableHead className="px-2 text-xs">L/S</TableHead>
                <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                <TableHead className="px-2 text-xs text-right">PNL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((pos) => (
                <TableRow key={pos.id} className="h-7">
                  <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[140px]">
                    {pos.nameCn || pos.nameEn}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-[11px] font-mono text-muted-foreground">
                    {pos.tickerBbg}
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pos.longShort === "long"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                      }`}>
                      {pos.longShort === "long" ? "L" : "S"}
                    </span>
                  </TableCell>
                  <TableCell className={`px-2 py-1 text-xs font-mono text-right font-medium ${pos.longShort === "long" ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatPct(pos.positionAmount / (summary?.aum || 1))}
                  </TableCell>
                  <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatUsdK(pos.pnl || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className="py-2">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              {card.label === "AUM" && editingAum ? (
                <Input
                  autoFocus
                  type="number"
                  className="h-7 text-sm font-bold px-1 w-full"
                  value={aumInput}
                  onChange={(e) => setAumInput(e.target.value)}
                  onBlur={saveAum}
                  onKeyDown={(e) => { if (e.key === "Enter") saveAum(); if (e.key === "Escape") setEditingAum(false); }}
                />
              ) : (
                <p
                  className={`text-lg font-bold ${card.color ?? ""} ${card.label === "AUM" ? "cursor-pointer hover:text-primary group inline-flex items-center gap-1" : ""}`}
                  onClick={card.label === "AUM" ? () => { setAumInput(String(summary.aum)); setEditingAum(true); } : undefined}
                >
                  {card.value}
                  {card.label === "AUM" && <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                </p>
              )}
              {card.sub && (
                <p className="text-[10px] text-muted-foreground">{card.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar Charts: Net Exposure & GMV */}
      <div className="grid grid-cols-2 gap-3">
        {/* Net Exposure Bar Chart */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Net Exposure 分布</CardTitle>
            <DimensionTabs current={netDim} onChange={setNetDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {netData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, netData.length * 28)}>
                <BarChart data={netData} layout="vertical" margin={{ top: 2, right: 40, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(netData)} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                          <p className="font-medium mb-1">{label}</p>
                          <p>Net: <span className={d.nmv >= 0 ? "text-emerald-600" : "text-rose-600"}>{d.nmv}%</span></p>
                          <p className="text-emerald-600">Long: {d.long}%</p>
                          <p className="text-rose-600">Short: {d.short}%</p>
                          <p className="text-muted-foreground mt-1">点击查看持仓明细</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="nmv" name="Net" barSize={14} radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data: any) => handleNetBarClick(data)} isAnimationActive={false}>
                    {netData.map((entry, index) => (
                      <Cell key={index} fill={entry.nmv >= 0 ? "#10b981" : "#f43f5e"}
                        opacity={selectedBar && selectedBar !== entry.name ? 0.3 : 1} />
                    ))}
                    <LabelList dataKey="nmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "#666" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {selectedBar && <DrillTable selected={selectedBar} data={drillPositions} onClose={() => setSelectedBar(null)} />}
          </CardContent>
        </Card>

        {/* GMV Bar Chart */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Gross Exposure 分布 (GMV)</CardTitle>
            <DimensionTabs current={gmvDim} onChange={setGmvDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {gmvData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, gmvData.length * 28)}>
                <BarChart data={gmvData} layout="vertical" margin={{ top: 2, right: 40, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(gmvData)} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                          <p className="font-medium mb-1">{label}</p>
                          <p>Gross: <span className="text-blue-600">{d.gmv}%</span></p>
                          <p className="text-emerald-600">Long: {d.long}%</p>
                          <p className="text-rose-600">Short: {d.short}%</p>
                          <p className="text-muted-foreground mt-1">点击查看持仓明细</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="gmv" name="Gross" barSize={14} radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data: any) => handleGmvBarClick(data)} isAnimationActive={false}>
                    {gmvData.map((entry, index) => (
                      <Cell key={index} fill="#3b82f6"
                        opacity={selectedGmvBar && selectedGmvBar !== entry.name ? 0.3 : 1} />
                    ))}
                    <LabelList dataKey="gmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "#666" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {selectedGmvBar && <DrillTable selected={selectedGmvBar} data={drillGmvPositions} onClose={() => setSelectedGmvBar(null)} />}
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts: NET Distribution & GMV Distribution */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">NET 分布 (饼图)</CardTitle>
            <DimensionTabs current={netPieDim} onChange={setNetPieDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {netPieData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <EChartsPie data={netPieData} />
            )}
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">GMV 分布 (饼图)</CardTitle>
            <DimensionTabs current={gmvPieDim} onChange={setGmvPieDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {gmvPieData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <EChartsPie data={gmvPieData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* PNL Section */}
      <div className="grid grid-cols-2 gap-3">
        {/* PNL Bar Chart */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">PNL 分布 (条形图)</CardTitle>
            <DimensionTabs current={pnlDim} onChange={setPnlDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {pnlData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无 PNL 数据 (请确认 Excel 中包含 PNL 列)</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, pnlData.length * 28)}>
                <BarChart data={pnlData} layout="vertical" margin={{ top: 2, right: 50, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatUsdK(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(pnlData)} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                          <p className="font-medium mb-1">{label}</p>
                          <p>PNL: <span className={d.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatUsdK(d.pnl)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pnl" name="PNL" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {pnlData.map((entry, index) => (
                      <Cell key={index} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                    <LabelList dataKey="pnl" position="right" formatter={(v: any) => formatUsdK(v)} style={{ fontSize: 10, fill: "#666" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PNL Pie Chart */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">PNL 分布 (饼图)</CardTitle>
            <DimensionTabs current={pnlPieDim} onChange={setPnlPieDim} />
          </CardHeader>
          <CardContent className="px-2 py-0">
            {pnlPieData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无 PNL 数据</p>
            ) : (
              <EChartsPie data={pnlPieData} formatter={formatUsdK} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Positions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1">
            <CardTitle className="text-sm">Top 10 Long</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6 px-2 text-xs">#</TableHead>
                  <TableHead className="px-2 text-xs">Company</TableHead>
                  <TableHead className="px-2 text-xs">Ticker</TableHead>
                  <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                  <TableHead className="px-2 text-xs text-right">PNL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {longPositions.map((pos, idx) => (
                  <TableRow key={pos.id} className="h-7">
                    <TableCell className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[120px]">
                      {pos.nameCn || pos.nameEn}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-[11px] font-mono text-muted-foreground">{pos.tickerBbg}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-mono text-right text-emerald-600 font-medium">
                      {formatPct(pos.positionAmount / summary.aum)}
                    </TableCell>
                    <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatUsdK(pos.pnl || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="px-4 py-1">
            <CardTitle className="text-sm">Top 10 Short</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6 px-2 text-xs">#</TableHead>
                  <TableHead className="px-2 text-xs">Company</TableHead>
                  <TableHead className="px-2 text-xs">Ticker</TableHead>
                  <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                  <TableHead className="px-2 text-xs text-right">PNL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortPositions.map((pos, idx) => (
                  <TableRow key={pos.id} className="h-7">
                    <TableCell className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[120px]">
                      {pos.nameCn || pos.nameEn}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-[11px] font-mono text-muted-foreground">{pos.tickerBbg}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-mono text-right text-rose-600 font-medium">
                      {formatPct(pos.positionAmount / summary.aum)}
                    </TableCell>
                    <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatUsdK(pos.pnl || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
