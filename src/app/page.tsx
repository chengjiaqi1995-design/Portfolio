"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { PieChart as EChartsPieChart, ScatterChart as EChartsScatterChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PortfolioSummary, PositionWithRelations, SummaryByDimension } from "@/lib/types";

echarts.use([EChartsPieChart, EChartsScatterChart, TooltipComponent, LegendComponent, GridComponent, LabelLayout, CanvasRenderer]);

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

// ===== ECharts Pie — with click callback =====
function EChartsPie({ data, formatter, height = 220, selected, onSelect }: {
  data: { name: string; value: number }[];
  formatter?: (value: number) => string;
  height?: number;
  selected?: string | null;
  onSelect?: (name: string | null) => void;
}) {
  const option = {
    tooltip: {
      trigger: "item",
      backgroundColor: "#FFFFFF",
      borderColor: "#E8E4DF",
      borderWidth: 1,
      textStyle: { color: "#1A1A1A", fontSize: 11 },
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
      textStyle: { fontSize: 9, color: "#6B6B6B" },
      formatter: (name: string) => name.length > 8 ? name.slice(0, 8) + "\u2026" : name,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 6,
    },
    series: [{
      type: "pie",
      radius: ["18%", "55%"],
      center: ["35%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 3, borderColor: "#FAFAF8", borderWidth: 2 },
      label: {
        show: true,
        formatter: (params: any) => {
          if (params.percent < 5) return "";
          return `${params.name}\n${params.percent.toFixed(1)}%`;
        },
        fontSize: 9,
        lineHeight: 12,
        color: "#1A1A1A",
      },
      labelLine: { show: true, length: 4, length2: 8, lineStyle: { color: "#E8E4DF" } },
      emphasis: {
        label: { show: true, fontSize: 11, fontWeight: "bold" },
        itemStyle: { shadowBlur: 8, shadowColor: "rgba(184,134,11,0.2)" },
      },
      data: data.map((d, i) => ({
        ...d,
        itemStyle: {
          color: PIE_COLORS[i % PIE_COLORS.length],
          opacity: selected && selected !== d.name ? 0.3 : 1,
        },
      })),
    }],
  };

  const onEvents: Record<string, Function> | undefined = onSelect ? {
    click: (params: any) => {
      onSelect(params.name === selected ? null : params.name);
    },
  } : undefined;

  return (
    <ReactEChartsCore echarts={echarts} option={option} onEvents={onEvents}
      style={{ height, width: "100%", cursor: onSelect ? "pointer" : "default" }}
      opts={{ renderer: "canvas" }} notMerge={true} />
  );
}

function calcYAxisWidth(data: { name: string }[]) {
  if (data.length === 0) return 60;
  const maxLen = Math.max(...data.map(d => d.name.length));
  return Math.min(Math.max(maxLen * 7, 60), 130);
}

// ===== ECharts Scatter — GMV vs PNL =====
function EChartsScatter({ data, height = 220 }: {
  data: { name: string; gmv: number; pnl: number; isLong: boolean }[];
  height?: number;
}) {
  const option = {
    grid: { top: 20, right: 20, bottom: 35, left: 55 },
    tooltip: {
      trigger: "item",
      backgroundColor: "#FFFFFF",
      borderColor: "#E8E4DF",
      borderWidth: 1,
      textStyle: { color: "#1A1A1A", fontSize: 11 },
      formatter: (params: any) => {
        const d = params.data;
        return `<b>${d.value[2]}</b><br/>GMV: ${formatUsdK(d.value[0])}<br/>PNL: <span style="color:${d.value[1] >= 0 ? '#2D6A4F' : '#C0392B'}">${formatUsdK(d.value[1])}</span>`;
      },
    },
    xAxis: {
      type: "value",
      name: "GMV",
      nameTextStyle: { fontSize: 9, color: "#6B6B6B" },
      axisLabel: { fontSize: 8, color: "#6B6B6B", formatter: (v: number) => formatUsdK(v) },
      splitLine: { lineStyle: { color: "#E8E4DF", type: "dashed" } },
    },
    yAxis: {
      type: "value",
      name: "PNL",
      nameTextStyle: { fontSize: 9, color: "#6B6B6B" },
      axisLabel: { fontSize: 8, color: "#6B6B6B", formatter: (v: number) => formatUsdK(v) },
      splitLine: { lineStyle: { color: "#E8E4DF", type: "dashed" } },
    },
    series: [{
      type: "scatter",
      symbolSize: 5,
      label: {
        show: true,
        formatter: (params: any) => params.value[2],
        position: "top",
        fontSize: 7,
        color: "#6B6B6B",
        overflow: "truncate",
        width: 60,
      },
      labelLayout: { hideOverlap: true },
      data: data.map(d => ({
        value: [d.gmv, d.pnl, d.name, d.isLong],
        itemStyle: { color: d.isLong ? "#B8860B" : "#6B6B6B", opacity: 0.8 },
      })),
    }],
  };

  return (
    <ReactEChartsCore echarts={echarts} option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }} notMerge={true} />
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<Dimension>("riskCountry");

  // Single unified selected category — shared across all 6 charts
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Reset selection on dimension change
  useEffect(() => { setSelectedCategory(null); }, [dim]);

  const toggleCategory = useCallback((name: string | null) => {
    setSelectedCategory(prev => prev === name ? null : name);
  }, []);

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

  // Linked positions table — filtered by selected category
  const activePositions = useMemo(() => {
    return positions.filter(p => (p.longShort === "long" || p.longShort === "short") && p.positionAmount > 0);
  }, [positions]);

  // Scatter plot data: all positions
  const scatterAllData = useMemo(() =>
    activePositions.map(p => ({
      name: p.nameCn || p.nameEn,
      gmv: p.positionAmount,
      pnl: p.pnl || 0,
      isLong: p.longShort === "long",
    })),
    [activePositions]);

  // Scatter plot data: dimension aggregates (each dot = one category)
  const scatterDimData = useMemo(() => {
    if (!summary) return [];
    return dimData
      .filter(d => d.gmv > 0.001)
      .map(d => ({
        name: d.name,
        gmv: d.gmv * summary.aum,
        pnl: d.pnl,
        isLong: d.nmv >= 0,
      }));
  }, [dimData, summary]);

  const filteredPositions = useMemo(() => {
    if (!selectedCategory) return activePositions;
    return activePositions.filter(p => getDimValue(p, dim) === selectedCategory);
  }, [activePositions, selectedCategory, dim]);

  const longPositions = useMemo(() =>
    filteredPositions.filter(p => p.longShort === "long").sort((a, b) => b.positionAmount - a.positionAmount),
    [filteredPositions]);

  const shortPositions = useMemo(() =>
    filteredPositions.filter(p => p.longShort === "short").sort((a, b) => b.positionAmount - a.positionAmount),
    [filteredPositions]);

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

  const barHeight = (data: any[]) => Math.max(80, data.length * 22);
  const tooltipBox = "rounded-md border border-[#E8E4DF] bg-white p-2 text-xs shadow-md";

  function PositionRow({ pos, idx }: { pos: PositionWithRelations; idx: number }) {
    const isLong = pos.longShort === "long";
    return (
      <TableRow className="h-6">
        <TableCell className="px-1.5 py-0.5 text-[11px] text-[var(--muted-foreground)] w-5">{idx + 1}</TableCell>
        <TableCell className="px-1.5 py-0.5 text-[11px] font-medium truncate max-w-[100px]">{pos.nameCn || pos.nameEn}</TableCell>
        <TableCell className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]">{pos.tickerBbg}</TableCell>
        <TableCell className={`px-1.5 py-0.5 text-[11px] font-mono text-right font-medium ${isLong ? "text-emerald-700" : "text-rose-700"}`}>
          {formatPct(pos.positionAmount / (summary?.aum || 1))}
        </TableCell>
        <TableCell className={`px-1.5 py-0.5 text-[11px] font-mono text-right ${(pos.pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
          {formatUsdK(pos.pnl || 0)}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Main area: Charts (left) + Positions (right) */}
      <div className="flex gap-3" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* LEFT: Charts (compact) */}
        <div className="w-[55%] flex-shrink-0 min-w-0 space-y-3">
          {/* NET row */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">Net Exposure</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {netData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : (
                  <ResponsiveContainer width="100%" height={barHeight(netData)}>
                    <BarChart data={netData} layout="vertical" margin={{ top: 2, right: 30, left: 2, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                      <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 8, fill: "#6B6B6B" }} />
                      <YAxis type="category" dataKey="name" width={calcYAxisWidth(netData)} tick={{ fontSize: 8, fill: "#1A1A1A" }} />
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
                      <Bar dataKey="nmv" barSize={10} radius={[0, 3, 3, 0]} cursor="pointer"
                        onClick={(data: any) => toggleCategory(data.name)} isAnimationActive={false}>
                        {netData.map((entry, i) => (
                          <Cell key={i} fill={entry.nmv >= 0 ? "#2D6A4F" : "#C0392B"} opacity={selectedCategory && selectedCategory !== entry.name ? 0.25 : 1} />
                        ))}
                        <LabelList dataKey="nmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 8, fill: "#6B6B6B" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">NET Distribution</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {netPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> :
                  <EChartsPie data={netPieData} height={barHeight(netData)} selected={selectedCategory} onSelect={toggleCategory} />}
              </CardContent>
            </Card>
          </div>

          {/* GMV row */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">Gross Exposure</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {gmvData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> : (
                  <ResponsiveContainer width="100%" height={barHeight(gmvData)}>
                    <BarChart data={gmvData} layout="vertical" margin={{ top: 2, right: 30, left: 2, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                      <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 8, fill: "#6B6B6B" }} />
                      <YAxis type="category" dataKey="name" width={calcYAxisWidth(gmvData)} tick={{ fontSize: 8, fill: "#1A1A1A" }} />
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
                      <Bar dataKey="gmv" barSize={10} radius={[0, 3, 3, 0]} cursor="pointer"
                        onClick={(data: any) => toggleCategory(data.name)} isAnimationActive={false}>
                        {gmvData.map((entry, i) => (
                          <Cell key={i} fill="#B8860B" opacity={selectedCategory && selectedCategory !== entry.name ? 0.25 : 1} />
                        ))}
                        <LabelList dataKey="gmv" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 8, fill: "#6B6B6B" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">GMV Distribution</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {gmvPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> :
                  <EChartsPie data={gmvPieData} height={barHeight(gmvData)} selected={selectedCategory} onSelect={toggleCategory} />}
              </CardContent>
            </Card>
          </div>

          {/* PNL row */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">PNL Breakdown</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {pnlData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No PNL data</p> : (
                  <ResponsiveContainer width="100%" height={barHeight(pnlData)}>
                    <BarChart data={pnlData} layout="vertical" margin={{ top: 2, right: 40, left: 2, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DF" />
                      <XAxis type="number" tickFormatter={v => formatUsdK(v)} tick={{ fontSize: 8, fill: "#6B6B6B" }} />
                      <YAxis type="category" dataKey="name" width={calcYAxisWidth(pnlData)} tick={{ fontSize: 8, fill: "#1A1A1A" }} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (<div className={tooltipBox}>
                          <p className="font-medium mb-1">{label}</p>
                          <p>PNL: <span className={d.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatUsdK(d.pnl)}</span></p>
                        </div>);
                      }} />
                      <Bar dataKey="pnl" barSize={10} radius={[0, 3, 3, 0]} cursor="pointer"
                        onClick={(data: any) => toggleCategory(data.name)} isAnimationActive={false}>
                        {pnlData.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "#2D6A4F" : "#C0392B"} opacity={selectedCategory && selectedCategory !== entry.name ? 0.25 : 1} />
                        ))}
                        <LabelList dataKey="pnl" position="right" formatter={(v: any) => formatUsdK(v)} style={{ fontSize: 8, fill: "#6B6B6B" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">PNL Distribution</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {pnlPieData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No PNL data</p> :
                  <EChartsPie data={pnlPieData} formatter={formatUsdK} height={barHeight(pnlData)} selected={selectedCategory} onSelect={toggleCategory} />}
              </CardContent>
            </Card>
          </div>

          {/* Scatter plots row */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1"><CardTitle className="font-serif text-sm font-semibold">GMV vs PNL — All</CardTitle></CardHeader>
              <CardContent className="px-1 py-0">
                {scatterAllData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> :
                  <EChartsScatter data={scatterAllData} height={260} />}
              </CardContent>
            </Card>
            <Card className="py-1.5">
              <CardHeader className="px-3 py-1">
                <CardTitle className="font-serif text-sm font-semibold">
                  GMV vs PNL — by {DIM_TABS.find(d => d.key === dim)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-1 py-0">
                {scatterDimData.length === 0 ? <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No data</p> :
                  <EChartsScatter data={scatterDimData} height={260} />}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* RIGHT: Linked Positions Table */}
        <div className="flex-1 min-w-0">
          <Card className="sticky top-0 flex flex-col py-1.5" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* Compact header — same height as chart card titles */}
            <CardHeader className="px-3 py-1 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-sm font-semibold">
                  {selectedCategory ? selectedCategory : "All Positions"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className={`small-caps text-[0.5625rem] ${selectedCategory ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)]'}`}>
                    {longPositions.length}L / {shortPositions.length}S
                  </span>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-0.5 rounded hover:bg-[var(--muted)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            {/* Two columns */}
            <CardContent className="px-0 py-0 flex-1 overflow-hidden">
              <div className="grid grid-cols-2 h-full">
                {/* Long column */}
                <div className="border-r border-[var(--border)] flex flex-col overflow-hidden">
                  <div className="px-3 py-1 border-b border-[var(--border)] flex-shrink-0">
                    <span className="small-caps text-[0.5rem] text-[var(--muted-foreground)]">Long · {longPositions.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {longPositions.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No longs</p>
                    ) : (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="w-5 px-1.5 text-[10px]">#</TableHead>
                          <TableHead className="px-1.5 text-[10px]">Company</TableHead>
                          <TableHead className="px-1.5 text-[10px]">Ticker</TableHead>
                          <TableHead className="px-1.5 text-[10px] text-right">Wgt</TableHead>
                          <TableHead className="px-1.5 text-[10px] text-right">PNL</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {longPositions.map((pos, idx) => <PositionRow key={pos.id} pos={pos} idx={idx} />)}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
                {/* Short column */}
                <div className="flex flex-col overflow-hidden">
                  <div className="px-3 py-1 border-b border-[var(--border)] flex-shrink-0">
                    <span className="small-caps text-[0.5rem] text-[var(--muted-foreground)]">Short · {shortPositions.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {shortPositions.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No shorts</p>
                    ) : (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="w-5 px-1.5 text-[10px]">#</TableHead>
                          <TableHead className="px-1.5 text-[10px]">Company</TableHead>
                          <TableHead className="px-1.5 text-[10px]">Ticker</TableHead>
                          <TableHead className="px-1.5 text-[10px] text-right">Wgt</TableHead>
                          <TableHead className="px-1.5 text-[10px] text-right">PNL</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {shortPositions.map((pos, idx) => <PositionRow key={pos.id} pos={pos} idx={idx} />)}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
