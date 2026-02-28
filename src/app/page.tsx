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
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PortfolioSummary, PositionWithRelations, SummaryByDimension } from "@/lib/types";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatAum(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

type NetDimension = "region" | "industry" | "theme" | "riskCountry" | "gicIndustry" | "exchangeCountry";

const NET_TABS: { key: NetDimension; label: string }[] = [
  { key: "region", label: "Sector (Old)" },
  { key: "industry", label: "Industry (Old)" },
  { key: "theme", label: "Theme (Old)" },
  { key: "riskCountry", label: "Risk Country" },
  { key: "gicIndustry", label: "GIC Industry" },
  { key: "exchangeCountry", label: "Exchange Country" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [netDim, setNetDim] = useState<NetDimension>("riskCountry");
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  // GMV States
  const [gmvDim, setGmvDim] = useState<NetDimension>("riskCountry");
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
  useEffect(() => {
    setSelectedBar(null);
  }, [netDim]);
  useEffect(() => {
    setSelectedGmvBar(null);
  }, [gmvDim]);

  const netData = useMemo(() => {
    if (!summary) return [];
    const source =
      netDim === "region" ? summary.byRegion :
        netDim === "industry" ? summary.byIndustry :
          netDim === "theme" ? summary.byTheme :
            netDim === "riskCountry" ? summary.byRiskCountry :
              netDim === "gicIndustry" ? summary.byGicIndustry :
                summary.byExchangeCountry;
    return source
      .filter((d) => Math.abs(d.nmv) > 0.001)
      .sort((a, b) => b.nmv - a.nmv)
      .map((d) => ({
        name: d.name,
        nmv: +(d.nmv * 100).toFixed(1),
        long: +(d.long * 100).toFixed(1),
        short: +(d.short * 100).toFixed(1),
      }));
  }, [summary, netDim]);

  const gmvData = useMemo(() => {
    if (!summary) return [];
    const source =
      gmvDim === "region" ? summary.byRegion :
        gmvDim === "industry" ? summary.byIndustry :
          gmvDim === "theme" ? summary.byTheme :
            gmvDim === "riskCountry" ? summary.byRiskCountry :
              gmvDim === "gicIndustry" ? summary.byGicIndustry :
                summary.byExchangeCountry;
    return source
      .filter((d) => Math.abs(d.gmv) > 0.001)
      .sort((a, b) => b.gmv - a.gmv)
      .map((d) => ({
        name: d.name,
        gmv: +(d.gmv * 100).toFixed(1),
        long: +(d.long * 100).toFixed(1),
        short: +(d.short * 100).toFixed(1),
      }));
  }, [summary, gmvDim]);

  // Positions filtered by selected bar
  const drillPositions = useMemo(() => {
    if (!selectedBar) return [];
    const active = positions.filter((p) => p.longShort === "long" || p.longShort === "short");
    let filtered: PositionWithRelations[];
    if (netDim === "region") {
      filtered = active.filter((p) => (p.market || "其他") === selectedBar);
    } else if (netDim === "industry") {
      filtered = active.filter((p) => (p.sector?.name || "其他") === selectedBar);
    } else if (netDim === "theme") {
      filtered = active.filter((p) => (p.topdown?.name || "Others") === selectedBar);
    } else if (netDim === "riskCountry") {
      filtered = active.filter((p) => (p.market || "其他") === selectedBar);
    } else if (netDim === "gicIndustry") {
      filtered = active.filter((p) => (p.gicIndustry || "其他") === selectedBar);
    } else {
      filtered = active.filter((p) => (p.exchangeCountry || "其他") === selectedBar);
    }
    return filtered.sort((a, b) => {
      if (a.longShort !== b.longShort) return a.longShort === "long" ? -1 : 1;
      return b.positionAmount - a.positionAmount;
    });
  }, [selectedBar, positions, netDim]);

  const drillGmvPositions = useMemo(() => {
    if (!selectedGmvBar) return [];
    const active = positions.filter((p) => p.longShort === "long" || p.longShort === "short");
    let filtered: PositionWithRelations[];
    if (gmvDim === "region") {
      filtered = active.filter((p) => (p.market || "其他") === selectedGmvBar);
    } else if (gmvDim === "industry") {
      filtered = active.filter((p) => (p.sector?.name || "其他") === selectedGmvBar);
    } else if (gmvDim === "theme") {
      filtered = active.filter((p) => (p.topdown?.name || "Others") === selectedGmvBar);
    } else if (gmvDim === "riskCountry") {
      filtered = active.filter((p) => (p.market || "其他") === selectedGmvBar);
    } else if (gmvDim === "gicIndustry") {
      filtered = active.filter((p) => (p.gicIndustry || "其他") === selectedGmvBar);
    } else {
      filtered = active.filter((p) => (p.exchangeCountry || "其他") === selectedGmvBar);
    }
    return filtered.sort((a, b) => {
      // For GMV drill, we still sort by amount but maybe absolute amount? Standard is absolute in GMV
      return Math.abs(b.positionAmount) - Math.abs(a.positionAmount);
    });
  }, [selectedGmvBar, positions, gmvDim]);

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
  ];


  const longPositions = positions
    .filter((p) => p.longShort === "long")
    .sort((a, b) => b.positionAmount - a.positionAmount)
    .slice(0, 10);

  const shortPositions = positions
    .filter((p) => p.longShort === "short")
    .sort((a, b) => b.positionAmount - a.positionAmount)
    .slice(0, 10);

  // Handle bar click in Net Exposure chart
  function handleNetBarClick(data: { name: string }) {
    setSelectedBar((prev) => (prev === data.name ? null : data.name));
  }

  function handleGmvBarClick(data: { name: string }) {
    setSelectedGmvBar((prev) => (prev === data.name ? null : data.name));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-3">
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

      {/* Exposure Distributions — Side by Side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Net Exposure Distribution — with tabs and drill-down */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Net Exposure 分布</CardTitle>
            <div className="flex gap-1">
              {NET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setNetDim(tab.key)}
                  className={`px-2.5 py-0.5 text-xs rounded-md transition-colors ${netDim === tab.key
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 py-0">
            {netData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, netData.length * 28)}>
                <BarChart
                  data={netData}
                  layout="vertical"
                  margin={{ top: 2, right: 40, left: 4, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
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
                  <Bar
                    dataKey="nmv"
                    name="Net"
                    barSize={14}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data: any) => handleNetBarClick(data)}
                    isAnimationActive={false}
                  >
                    {netData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.nmv >= 0 ? "#10b981" : "#f43f5e"}
                        opacity={selectedBar && selectedBar !== entry.name ? 0.3 : 1}
                      />
                    ))}
                    <LabelList
                      dataKey="nmv"
                      position="right"
                      formatter={(v: any) => `${v}%`}
                      style={{ fontSize: 10, fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Drill-down position table */}
            {selectedBar && (
              <div className="mt-2 mb-2 mx-2 border rounded-md">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
                  <span className="text-xs font-medium">
                    {selectedBar} — {drillPositions.length} 个持仓
                  </span>
                  <button
                    onClick={() => setSelectedBar(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {drillPositions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">无持仓</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2 text-xs">Company</TableHead>
                        <TableHead className="px-2 text-xs">Ticker</TableHead>
                        <TableHead className="px-2 text-xs">L/S</TableHead>
                        <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                        <TableHead className="px-2 text-xs">Market</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillPositions.map((pos) => (
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
                          <TableCell className={`px-2 py-1 text-xs font-mono text-right font-medium ${pos.longShort === "long" ? "text-emerald-600" : "text-rose-600"
                            }`}>
                            {formatPct(pos.positionAmount / summary.aum)}
                          </TableCell>
                          <TableCell className="px-2 py-1 text-xs text-muted-foreground">
                            {pos.market}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gross Exposure Distribution */}
        <Card className="py-2">
          <CardHeader className="px-4 py-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Gross Exposure 分布 (GMV)</CardTitle>
            <div className="flex gap-1">
              {NET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setGmvDim(tab.key)}
                  className={`px-2.5 py-0.5 text-xs rounded-md transition-colors ${gmvDim === tab.key
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 py-0">
            {gmvData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, gmvData.length * 28)}>
                <BarChart
                  data={gmvData}
                  layout="vertical"
                  margin={{ top: 2, right: 40, left: 4, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
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
                  <Bar
                    dataKey="gmv"
                    name="Gross"
                    barSize={14}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data: any) => handleGmvBarClick(data)}
                    isAnimationActive={false}
                  >
                    {gmvData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill="#3b82f6"
                        opacity={selectedGmvBar && selectedGmvBar !== entry.name ? 0.3 : 1}
                      />
                    ))}
                    <LabelList
                      dataKey="gmv"
                      position="right"
                      formatter={(v: any) => `${v}%`}
                      style={{ fontSize: 10, fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Drill-down position table */}
            {selectedGmvBar && (
              <div className="mt-2 mb-2 mx-2 border rounded-md">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
                  <span className="text-xs font-medium">
                    {selectedGmvBar} — {drillGmvPositions.length} 个持仓
                  </span>
                  <button
                    onClick={() => setSelectedGmvBar(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {drillGmvPositions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">无持仓</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2 text-xs">Company</TableHead>
                        <TableHead className="px-2 text-xs">Ticker</TableHead>
                        <TableHead className="px-2 text-xs">L/S</TableHead>
                        <TableHead className="px-2 text-xs text-right">Weight</TableHead>
                        <TableHead className="px-2 text-xs">Market</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillGmvPositions.map((pos) => (
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
                          <TableCell className={`px-2 py-1 text-xs font-mono text-right font-medium ${pos.longShort === "long" ? "text-emerald-600" : "text-rose-600"
                            }`}>
                            {formatPct(pos.positionAmount / summary.aum)}
                          </TableCell>
                          <TableCell className="px-2 py-1 text-xs text-muted-foreground">
                            {pos.market}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Positions — two tables side by side */}
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
