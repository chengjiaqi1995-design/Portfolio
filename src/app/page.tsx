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

// Warm editorial pie colors
const PIE_COLORS = [
  "#B8860B", "#2D6A4F", "#4A6FA5", "#C77D4F", "#7B6D8D",
  "#D4A84B", "#3D8B6E", "#6B8FC2", "#D9976A", "#9B8DAA",
  "#8B7355", "#1A6B5A", "#5B7E9E", "#A86B3D", "#6A5B7B",
  "#C4A55C", "#4E9E7F", "#7DA0C4", "#B58458", "#887B9B",
];

function getDimData(summary: PortfolioSummary, dim: Dimension): SummaryByDimension[] {
  if (dim === "sector") return summary.bySector;
  if (dim === "industry") return summary.byIndustry;
  if (dim === "theme") return summary.byTheme;
  if (dim === "riskCountry") return summary.byRiskCountry;
  if (dim === "gicIndustry") return summary.byGicIndustry;
  return summary.byExchangeCountry;
}

function getDimValue(p: PositionWithRelations, dim: Dimension): string {
  if (dim === "sector") return p.market || "Other";
  if (dim === "industry") return p.sector?.name || "Other";
  if (dim === "theme") return p.topdown?.name || "Others";
  if (dim === "riskCountry") return p.market || "Other";
  if (dim === "gicIndustry") return p.gicIndustry || "Other";
  return p.exchangeCountry || "Other";
}

// ===== ECharts Pie — Serif-themed =====
function EChartsPie({ data, formatter, height = 280 }: { data: { name: string; value: number }[]; formatter?: (value: number) => string; height?: number }) {
  const option = {
    tooltip: {
      trigger: "item",
      backgroundColor: "#FFFFFF",
      borderColor: "#E8E4DF",
      borderWidth: 1,
      textStyle: { color: "#1A1A1A", fontSize: 12 },
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
      textStyle: { fontSize: 10, color: "#6B6B6B" },
      formatter: (name: string) => name.length > 10 ? name.slice(0, 10) + "\u2026" : name,
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: "pie",
      radius: ["20%", "58%"],
      center: ["32%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 3, borderColor: "#FAFAF8", borderWidth: 2 },
      label: {
        show: true,
        formatter: (params: any) => {
          if (params.percent < 4) return "";
          return `${params.name}\n${params.percent.toFixed(1)}%`;
        },
        fontSize: 10,
        lineHeight: 13,
        color: "#1A1A1A",
      },
      labelLine: { show: true, length: 6, length2: 10, lineStyle: { color: "#E8E4DF" } },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: "bold" },
        itemStyle: { shadowBlur: 8, shadowColor: "rgba(184,134,11,0.2)" },
      },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] } })),
    }],
  };
  return (
    <ReactEChartsCore echarts={echarts} option={option}
      style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} notMerge={true} />
  );
}

function calcYAxisWidth(data: { name: string }[]) {
  if (data.length === 0) return 60;
  const maxLen = Math.max(...data.map(d => d.name.length));
  return Math.min(Math.max(maxLen * 7, 60), 150);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<Dimension>("riskCountry");
  const [selectedNetBar, setSelectedNetBar] = useState<string | null>(null);
  const [selectedGmvBar, setSelectedGmvBar] = useState<string | null>(null);
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

  useEffect(() => { refreshData(); setLoading(false); }, []);

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

  useEffect(() => { setSelectedNetBar(null); setSelectedGmvBar(null); }, [dim]);

  const dimData = useMemo(() => {
    if (!summary) return [];
    return getDimData(summary, dim);
  }, [summary, dim]);

  const netData = useMemo(() =>
    dimData.filter(d => Math.abs(d.nmv) > 0.001).sort((a, b) => b.nmv - a.nmv)
      .map(d => ({ name: d.name, nmv: +(d.nmv * 100).toFixed(1), long: +(d.long * 100).toFixed(1), short: +(d.short * 100).toFixed(1) })),
    [dimData]);

  const gmvData = useMemo(() =>
    dimData.filter(d => d.gmv > 0.001).sort((a, b) => b.gmv - a.gmv)
      .map(d => ({ name: d.name, gmv: +(d.gmv * 100).toFixed(1), long: +(d.long * 100).toFixed(1), short: +(d.short * 100).toFixed(1) })),
    [dimData]);

  const pnlData = useMemo(() =>
    dimData.filter(d => Math.abs(d.pnl) > 0.01).sort((a, b) => b.pnl - a.pnl)
      .map(d => ({ name: d.name, pnl: Math.round(d.pnl) })),
    [dimData]);

  const netPieData = useMemo(() =>
    dimData.filter(d => d.gmv > 0.001).sort((a, b) => b.gmv - a.gmv)
      .map(d => ({ name: d.name, value: +(Math.abs(d.nmv) * 100).toFixed(1) })),
    [dimData]);

  const gmvPieData = useMemo(() =>
    dimData.filter(d => d.gmv > 0.001).sort((a, b) => b.gmv - a.gmv)
      .map(d => ({ name: d.name, value: +(d.gmv * 100).toFixed(1) })),
    [dimData]);

  const pnlPieData = useMemo(() =>
    dimData.filter(d => Math.abs(d.pnl) > 0.01).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .map(d => ({ name: d.name, value: Math.round(Math.abs(d.pnl)) })),
    [dimData]);

  const drillNetPositions = useMemo(() => {
    if (!selectedNetBar) return [];
    return positions
      .filter(p => (p.longShort === "long" || p.longShort === "short") && getDimValue(p, dim) === selectedNetBar)
      .sort((a, b) => b.positionAmount - a.positionAmount);
  }, [selectedNetBar, positions, dim]);

  const drillGmvPositions = useMemo(() => {
    if (!selectedGmvBar) return [];
    return positions
      .filter(p => (p.longShort === "long" || p.longShort === "short") && getDimValue(p, dim) === selectedGmvBar)
      .sort((a, b) => Math.abs(b.positionAmount) - Math.abs(a.positionAmount));
  }, [selectedGmvBar, positions, dim]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>;
  }
  if (!summary) {
    return <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">Failed to load portfolio summary.</div>;
  }

  const statCards = [
    { label: "AUM", value: formatAum(summary.aum), sub: `${summary.longCount}L / ${summary.shortCount}S / ${summary.watchlistCount}W` },
    { label: "NMV%", value: formatPct(summary.nmv), color: summary.nmv >= 0 ? "text-emerald-700" : "text-rose-700" },
    { label: "GMV%", value: formatPct(summary.gmv), color: "text-[var(--accent)]" },
    { label: "Long%", value: formatPct(summary.totalLong), color: "text-emerald-700" },
    { label: "Short%", value: formatPct(summary.totalShort), color: "text-rose-700" },
    { label: "PNL", value: formatUsdK(summary.totalPnl || 0), color: (summary.totalPnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700" },
  ];

  const longPositions = positions.filter(p => p.longShort === "long").sort((a, b) => b.positionAmount - a.positionAmount).slice(0, 10);
  const shortPositions = positions.filter(p => p.longShort === "short").sort((a, b) => b.positionAmount - a.positionAmount).slice(0, 10);

  function DrillTable({ selected, data, onClose }: { selected: string; data: PositionWithRelations[]; onClose: () => void }) {
    return (
      <div className="mt-2 mb-2 mx-1 border border-[var(--border)] rounded-md">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]/50 border-b border-[var(--border)]">
          <span className="small-caps text-[0.625rem] text-[var(--accent)]">{selected} — {data.length} positions</span>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"><X className="h-3.5 w-3.5" /></button>
        </div>
        {data.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] py-3 text-center">No positions</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="px-2 text-xs">Company</TableHead>
              <TableHead className="px-2 text-xs">Ticker</TableHead>
              <TableHead className="px-2 text-xs">L/S</TableHead>
              <TableHead className="px-2 text-xs text-right">Weight</TableHead>
              <TableHead className="px-2 text-xs text-right">PNL</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map(pos => (
                <TableRow key={pos.id} className="h-7">
                  <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[120px]">{pos.nameCn || pos.nameEn}</TableCell>
                  <TableCell className="px-2 py-1 text-[11px] font-mono text-[var(--muted-foreground)]">{pos.tickerBbg}</TableCell>
                  <TableCell className="px-2 py-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pos.longShort === "long" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {pos.longShort === "long" ? "L" : "S"}
                    </span>
                  </TableCell>
                  <TableCell className={`px-2 py-1 text-xs font-mono text-right font-medium ${pos.longShort === "long" ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatPct(pos.positionAmount / (summary?.aum || 1))}
                  </TableCell>
                  <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
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

  const barHeight = (data: any[]) => Math.max(100, data.length * 26);

  // Recharts tooltip style
  const tooltipBox = "rounded-md border border-[#E8E4DF] bg-white p-2 text-xs shadow-md";

  return (
    <div className="space-y-5">
      {/* Header + Global Dimension Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight">Dashboard</h1>
          <div className="h-0.5 w-12 bg-[var(--accent)] mt-1 rounded-full" />
        </div>
        <div className="flex items-center gap-0.5 border border-[var(--border)] rounded-lg px-1 py-0.5">
          {DIM_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setDim(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${dim === tab.key
                ? "bg-[var(--accent)] text-white font-medium shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              style={{ letterSpacing: "0.03em" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-6 gap-3">
        {statCards.map(card => (
          <Card key={card.label} className="py-3 card-accent-top">
            <CardContent className="px-4 py-0">
              <p className="small-caps text-[0.5625rem] mb-1">{card.label}</p>
              {card.label === "AUM" && editingAum ? (
                <Input autoFocus type="number" className="h-7 text-sm font-bold px-1 w-full"
                  value={aumInput} onChange={e => setAumInput(e.target.value)}
                  onBlur={saveAum} onKeyDown={e => { if (e.key === "Enter") saveAum(); if (e.key === "Escape") setEditingAum(false); }} />
              ) : (
                <p className={`font-serif text-xl font-semibold ${card.color ?? ""} ${card.label === "AUM" ? "cursor-pointer hover:text-[var(--accent)] group inline-flex items-center gap-1 transition-colors" : ""}`}
                  onClick={card.label === "AUM" ? () => { setAumInput(String(summary.aum)); setEditingAum(true); } : undefined}>
                  {card.value}
                  {card.label === "AUM" && <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                </p>
              )}
              {card.sub && <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: NET — Bar + Pie */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">Net Exposure</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {netData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : (
              <ResponsiveContainer width="100%" height={barHeight(netData)}>
                <BarChart data={netData} layout="vertical" margin={{ top: 2, right: 35, left: 2, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                  <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "#6B6B6B" }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(netData)} tick={{ fontSize: 9, fill: "#1A1A1A" }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (<div className={tooltipBox}>
                      <p className="font-medium mb-1">{label}</p>
                      <p>Net: <span className={d.nmv >= 0 ? "text-emerald-700" : "text-rose-700"}>{d.nmv}%</span></p>
                      <p className="text-emerald-700">Long: {d.long}%</p>
                      <p className="text-rose-700">Short: {d.short}%</p>
                    </div>);
                  }} />
                  <Bar dataKey="nmv" barSize={12} radius={[0, 3, 3, 0]} cursor="pointer"
                    onClick={(data: any) => setSelectedNetBar(prev => prev === data.name ? null : data.name)} isAnimationActive={false}>
                    {netData.map((entry, i) => (
                      <Cell key={i} fill={entry.nmv >= 0 ? "#2D6A4F" : "#C0392B"} opacity={selectedNetBar && selectedNetBar !== entry.name ? 0.3 : 1} />
                    ))}
                    <LabelList dataKey="nmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fill: "#6B6B6B" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {selectedNetBar && <DrillTable selected={selectedNetBar} data={drillNetPositions} onClose={() => setSelectedNetBar(null)} />}
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">NET Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {netPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : <EChartsPie data={netPieData} />}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: GMV — Bar + Pie */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">Gross Exposure</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {gmvData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : (
              <ResponsiveContainer width="100%" height={barHeight(gmvData)}>
                <BarChart data={gmvData} layout="vertical" margin={{ top: 2, right: 35, left: 2, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                  <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "#6B6B6B" }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(gmvData)} tick={{ fontSize: 9, fill: "#1A1A1A" }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (<div className={tooltipBox}>
                      <p className="font-medium mb-1">{label}</p>
                      <p>Gross: <span className="text-[var(--accent)]">{d.gmv}%</span></p>
                      <p className="text-emerald-700">Long: {d.long}%</p>
                      <p className="text-rose-700">Short: {d.short}%</p>
                    </div>);
                  }} />
                  <Bar dataKey="gmv" barSize={12} radius={[0, 3, 3, 0]} cursor="pointer"
                    onClick={(data: any) => setSelectedGmvBar(prev => prev === data.name ? null : data.name)} isAnimationActive={false}>
                    {gmvData.map((entry, i) => (
                      <Cell key={i} fill="#B8860B" opacity={selectedGmvBar && selectedGmvBar !== entry.name ? 0.3 : 1} />
                    ))}
                    <LabelList dataKey="gmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fill: "#6B6B6B" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {selectedGmvBar && <DrillTable selected={selectedGmvBar} data={drillGmvPositions} onClose={() => setSelectedGmvBar(null)} />}
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">GMV Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {gmvPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : <EChartsPie data={gmvPieData} />}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: PNL — Bar + Pie */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">PNL Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {pnlData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No PNL data</p> : (
              <ResponsiveContainer width="100%" height={barHeight(pnlData)}>
                <BarChart data={pnlData} layout="vertical" margin={{ top: 2, right: 45, left: 2, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                  <XAxis type="number" tickFormatter={v => formatUsdK(v)} tick={{ fontSize: 9, fill: "#6B6B6B" }} />
                  <YAxis type="category" dataKey="name" width={calcYAxisWidth(pnlData)} tick={{ fontSize: 9, fill: "#1A1A1A" }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (<div className={tooltipBox}>
                      <p className="font-medium mb-1">{label}</p>
                      <p>PNL: <span className={d.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatUsdK(d.pnl)}</span></p>
                    </div>);
                  }} />
                  <Bar dataKey="pnl" barSize={12} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {pnlData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? "#2D6A4F" : "#C0392B"} />)}
                    <LabelList dataKey="pnl" position="right" formatter={(v: any) => formatUsdK(v)} style={{ fontSize: 9, fill: "#6B6B6B" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">PNL Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-1 py-0">
            {pnlPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No PNL data</p> : <EChartsPie data={pnlPieData} formatter={formatUsdK} />}
          </CardContent>
        </Card>
      </div>

      {/* Top Positions */}
      <div className="flex items-center gap-4 mt-2">
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="small-caps text-[var(--accent)]">Top Holdings</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">Top 10 Long</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-6 px-2 text-xs">#</TableHead>
                <TableHead className="px-2 text-xs">Company</TableHead>
                <TableHead className="px-2 text-xs">Ticker</TableHead>
                <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                <TableHead className="px-2 text-xs text-right">PNL</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {longPositions.map((pos, idx) => (
                  <TableRow key={pos.id} className="h-7">
                    <TableCell className="px-2 py-1 text-xs text-[var(--muted-foreground)]">{idx + 1}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[120px]">{pos.nameCn || pos.nameEn}</TableCell>
                    <TableCell className="px-2 py-1 text-[11px] font-mono text-[var(--muted-foreground)]">{pos.tickerBbg}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-mono text-right text-emerald-700 font-medium">{formatPct(pos.positionAmount / summary.aum)}</TableCell>
                    <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatUsdK(pos.pnl || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="px-4 py-1.5">
            <CardTitle className="font-serif text-base font-semibold">Top 10 Short</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-6 px-2 text-xs">#</TableHead>
                <TableHead className="px-2 text-xs">Company</TableHead>
                <TableHead className="px-2 text-xs">Ticker</TableHead>
                <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                <TableHead className="px-2 text-xs text-right">PNL</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {shortPositions.map((pos, idx) => (
                  <TableRow key={pos.id} className="h-7">
                    <TableCell className="px-2 py-1 text-xs text-[var(--muted-foreground)]">{idx + 1}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium truncate max-w-[120px]">{pos.nameCn || pos.nameEn}</TableCell>
                    <TableCell className="px-2 py-1 text-[11px] font-mono text-[var(--muted-foreground)]">{pos.tickerBbg}</TableCell>
                    <TableCell className="px-2 py-1 text-xs font-mono text-right text-rose-700 font-medium">{formatPct(pos.positionAmount / summary.aum)}</TableCell>
                    <TableCell className={`px-2 py-1 text-xs font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatUsdK(pos.pnl || 0)}</TableCell>
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
