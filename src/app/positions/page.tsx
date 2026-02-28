"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Search, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { PositionWithRelations, TaxonomyItem } from "@/lib/types";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMarketCap(rmb: number): string {
  return rmb.toFixed(1);
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [taxonomies, setTaxonomies] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [aum, setAum] = useState(10_000_000);
  const [search, setSearch] = useState("");
  const [filterMarket, setFilterMarket] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterTheme, setFilterTheme] = useState<string>("all");
  const [filterLongShort, setFilterLongShort] = useState<string>("all");

  // Sorting
  type SortKey = "priority" | "topdown" | "sector" | "theme" | "market" | "longShort" | "positionWeight";
  const [sortKey, setSortKey] = useState<SortKey>("positionWeight");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "positionWeight" ? "desc" : "asc");
    }
  }

  // Sheet
  const [selectedPosition, setSelectedPosition] =
    useState<PositionWithRelations | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Sheet edit form state (only fields not handled inline)
  const [editLongShort, setEditLongShort] = useState("");
  const [editPositionAmount, setEditPositionAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Track which cell is currently saving (posId-field)
  const [savingCell, setSavingCell] = useState<string | null>(null);

  // New taxonomy dialog state
  const [newTaxDialog, setNewTaxDialog] = useState<{
    open: boolean;
    type: "topdown" | "sector" | "theme";
    field: "topdownId" | "sectorId" | "themeId";
    pos: PositionWithRelations | null;
  }>({ open: false, type: "topdown", field: "topdownId", pos: null });
  const [newTaxName, setNewTaxName] = useState("");
  const [creatingTax, setCreatingTax] = useState(false);

  // Rename taxonomy dialog state
  const [renameTaxDialog, setRenameTaxDialog] = useState<{
    open: boolean;
    item: TaxonomyItem | null;
  }>({ open: false, item: null });
  const [renameTaxName, setRenameTaxName] = useState("");
  const [renamingTax, setRenamingTax] = useState(false);

  async function handleCreateTaxonomy() {
    if (!newTaxName.trim() || !newTaxDialog.pos) return;
    setCreatingTax(true);
    try {
      // Create the taxonomy item
      const res = await fetch("/api/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newTaxDialog.type, name: newTaxName.trim() }),
      });
      if (!res.ok) throw new Error("Create failed");
      const created: TaxonomyItem = await res.json();

      // Assign it to the position
      await inlineSave(newTaxDialog.pos, newTaxDialog.field, created.id);

      // Refresh taxonomy list
      const taxRes = await fetch("/api/taxonomy");
      const taxData = await taxRes.json();
      setTaxonomies(taxData);

      setNewTaxDialog((prev) => ({ ...prev, open: false }));
      setNewTaxName("");
    } catch {
      toast.error("创建失败");
    } finally {
      setCreatingTax(false);
    }
  }

  async function handleRenameTaxonomy() {
    if (!renameTaxName.trim() || !renameTaxDialog.item) return;
    setRenamingTax(true);
    try {
      const res = await fetch(`/api/taxonomy/${renameTaxDialog.item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameTaxName.trim() }),
      });
      if (!res.ok) throw new Error("Rename failed");
      toast.success("重命名成功");

      // Refresh taxonomy list and positions
      const taxRes = await fetch("/api/taxonomy");
      const taxData = await taxRes.json();
      setTaxonomies(taxData);
      fetchData();

      setRenameTaxDialog({ open: false, item: null });
      setRenameTaxName("");
    } catch {
      toast.error("重命名失败");
    } finally {
      setRenamingTax(false);
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, taxRes, settingsRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/taxonomy"),
        fetch("/api/settings"),
      ]);
      const posData = await posRes.json();
      const taxData = await taxRes.json();
      const settingsData = await settingsRes.json();
      setPositions(posData);
      setTaxonomies(taxData);
      if (settingsData.aum) setAum(settingsData.aum);
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived taxonomy lists
  const sectors = useMemo(
    () => taxonomies.filter((t) => t.type === "sector"),
    [taxonomies]
  );
  const themes = useMemo(
    () => taxonomies.filter((t) => t.type === "theme"),
    [taxonomies]
  );
  const topdowns = useMemo(
    () => taxonomies.filter((t) => t.type === "topdown"),
    [taxonomies]
  );
  const markets = useMemo(() => {
    const set = new Set(positions.map((p) => p.market).filter(Boolean));
    return Array.from(set).sort();
  }, [positions]);

  // Filtered and sorted positions
  const filteredPositions = useMemo(() => {
    let result = [...positions];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.tickerBbg.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.nameCn.toLowerCase().includes(q)
      );
    }
    if (filterMarket !== "all") {
      result = result.filter((p) => p.market === filterMarket);
    }
    if (filterSector !== "all") {
      result = result.filter((p) => String(p.sectorId) === filterSector);
    }
    if (filterTheme !== "all") {
      result = result.filter((p) => String(p.themeId) === filterTheme);
    }
    if (filterLongShort !== "all") {
      result = result.filter((p) => p.longShort === filterLongShort);
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "priority": av = a.priority || ""; bv = b.priority || ""; break;
        case "topdown": av = a.topdown?.name || ""; bv = b.topdown?.name || ""; break;
        case "sector": av = a.sector?.name || ""; bv = b.sector?.name || ""; break;
        case "theme": av = a.theme?.name || ""; bv = b.theme?.name || ""; break;
        case "market": av = a.market || ""; bv = b.market || ""; break;
        case "longShort": av = a.longShort; bv = b.longShort; break;
        case "positionWeight": av = a.positionAmount / aum; bv = b.positionAmount / aum; break;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return result;
  }, [positions, search, filterMarket, filterSector, filterTheme, filterLongShort, sortKey, sortDir, aum]);

  // Tab splits
  const activePositions = filteredPositions.filter(
    (p) => p.longShort === "long" || p.longShort === "short"
  );
  const watchlistPositions = filteredPositions.filter(
    (p) => p.longShort === "/"
  );

  // Inline save: update a single field and propagate to same-ticker positions
  async function inlineSave(pos: PositionWithRelations, field: string, value: unknown) {
    const cellKey = `${pos.id}-${field}`;
    setSavingCell(cellKey);

    // Optimistic update: apply to all positions with same ticker
    setPositions((prev) =>
      prev.map((p) => {
        if (p.tickerBbg === pos.tickerBbg) {
          const updated = { ...p, [field]: value };
          // Also update the resolved taxonomy object for display
          if (field === "sectorId") {
            updated.sector = value ? (sectors.find((s) => s.id === value) ?? null) : null;
          } else if (field === "themeId") {
            updated.theme = value ? (themes.find((t) => t.id === value) ?? null) : null;
          } else if (field === "topdownId") {
            updated.topdown = value ? (topdowns.find((t) => t.id === value) ?? null) : null;
          }
          return updated;
        }
        return p;
      })
    );

    try {
      const res = await fetch(`/api/positions/${pos.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      toast.error("保存失败");
      fetchData(); // revert on error
    } finally {
      setSavingCell(null);
    }
  }

  function openSheet(pos: PositionWithRelations) {
    setSelectedPosition(pos);
    setEditLongShort(pos.longShort);
    setEditPositionAmount(String(pos.positionAmount));
    setSheetOpen(true);
  }

  async function handleSheetSave() {
    if (!selectedPosition) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/positions/${selectedPosition.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longShort: editLongShort,
          positionAmount: Number(editPositionAmount) || 0,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("保存成功");
      setSheetOpen(false);
      fetchData();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  function renderTable(data: PositionWithRelations[]) {
    if (data.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground">暂无数据</div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {([
              { key: "priority" as SortKey, label: "Priority", className: "w-16 px-1" },
              { key: "topdown" as SortKey, label: "Topdown", className: "px-1" },
              { key: "sector" as SortKey, label: "Sector", className: "px-1" },
              { key: "theme" as SortKey, label: "Theme", className: "px-1" },
              { key: "market" as SortKey, label: "Market", className: "px-1" },
            ] as const).map((col) => (
              <TableHead
                key={col.key}
                className={`${col.className} cursor-pointer select-none hover:text-foreground`}
                onClick={() => toggleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </TableHead>
            ))}
            <TableHead className="px-1">Company</TableHead>
            <TableHead
              className="w-14 px-1 cursor-pointer select-none hover:text-foreground"
              onClick={() => toggleSort("longShort")}
            >
              <span className="flex items-center gap-1">
                L/S
                {sortKey === "longShort" ? (
                  sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-30" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="text-right px-1 cursor-pointer select-none hover:text-foreground"
              onClick={() => toggleSort("positionWeight")}
            >
              <span className="flex items-center justify-end gap-1">
                Position%
                {sortKey === "positionWeight" ? (
                  sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-30" />
                )}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((pos) => (
            <TableRow
              key={pos.id}
            >
              {/* Priority - inline select */}
              <TableCell className="px-1 py-0.5">
                <Select
                  value={pos.priority || "_none"}
                  onValueChange={(v) => inlineSave(pos, "priority", v === "_none" ? "" : v)}
                >
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none bg-transparent px-1 w-full min-w-[50px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    <SelectItem value="!!!">!!!</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Topdown - inline select */}
              <TableCell className="px-1 py-0.5">
                <Select
                  value={pos.topdownId ? String(pos.topdownId) : "_none"}
                  onValueChange={(v) => {
                    if (v === "_new") {
                      setNewTaxDialog({ open: true, type: "topdown", field: "topdownId", pos });
                      return;
                    }
                    inlineSave(pos, "topdownId", v === "_none" ? null : Number(v));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none bg-transparent px-1 w-full min-w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {topdowns.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="_new" className="text-primary">
                      <span className="flex items-center gap-1"><Plus className="h-3 w-3" />新增</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Sector - inline select */}
              <TableCell className="px-1 py-0.5">
                <Select
                  value={pos.sectorId ? String(pos.sectorId) : "_none"}
                  onValueChange={(v) => {
                    if (v === "_new") {
                      setNewTaxDialog({ open: true, type: "sector", field: "sectorId", pos });
                      return;
                    }
                    inlineSave(pos, "sectorId", v === "_none" ? null : Number(v));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none bg-transparent px-1 w-full min-w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="_new" className="text-primary">
                      <span className="flex items-center gap-1"><Plus className="h-3 w-3" />新增</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Theme - inline select */}
              <TableCell className="px-1 py-0.5">
                <Select
                  value={pos.themeId ? String(pos.themeId) : "_none"}
                  onValueChange={(v) => {
                    if (v === "_new") {
                      setNewTaxDialog({ open: true, type: "theme", field: "themeId", pos });
                      return;
                    }
                    inlineSave(pos, "themeId", v === "_none" ? null : Number(v));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none bg-transparent px-1 w-full min-w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {themes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="_new" className="text-primary">
                      <span className="flex items-center gap-1"><Plus className="h-3 w-3" />新增</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Market - read-only */}
              <TableCell className="text-xs px-1">{pos.market}</TableCell>

              {/* Company - clickable to open sheet */}
              <TableCell
                className="cursor-pointer px-1"
                onClick={() => openSheet(pos)}
              >
                <div className="font-medium text-sm">{pos.nameCn || pos.nameEn}</div>
                <div className="text-xs text-muted-foreground">
                  {pos.tickerBbg}
                </div>
              </TableCell>

              <TableCell className="px-1">
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold border ${pos.longShort === "long"
                      ? "border-[#B8860B] text-[#B8860B]"
                      : pos.longShort === "short"
                        ? "border-[#6B6B6B] text-[#6B6B6B]"
                        : "border-[#E8E4DF] text-[#E8E4DF]"
                    }`}
                >
                  {pos.longShort === "long" ? "L" : pos.longShort === "short" ? "S" : "/"}
                </span>
              </TableCell>

              {/* Position% */}
              <TableCell className="text-right font-mono text-sm px-1">
                {formatPct(pos.positionAmount / aum)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">个股管理</h1>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索公司/代码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterMarket} onValueChange={setFilterMarket}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部市场</SelectItem>
            {markets.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部板块</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTheme} onValueChange={setFilterTheme}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部主题</SelectItem>
            {themes.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLongShort} onValueChange={setFilterLongShort}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="L/S" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
            <SelectItem value="/">/</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            实盘持仓
            <Badge variant="secondary" className="ml-2">
              {activePositions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="watchlist">
            观察池
            <Badge variant="secondary" className="ml-2">
              {watchlistPositions.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">{renderTable(activePositions)}</TabsContent>
        <TabsContent value="watchlist">
          {renderTable(watchlistPositions)}
        </TabsContent>
      </Tabs>

      {/* New Taxonomy Dialog */}
      <Dialog
        open={newTaxDialog.open}
        onOpenChange={(open) => {
          setNewTaxDialog((prev) => ({ ...prev, open }));
          if (!open) setNewTaxName("");
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>
              新增{newTaxDialog.type === "topdown" ? " Topdown" : newTaxDialog.type === "sector" ? " Sector" : " Theme"}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="输入名称"
            value={newTaxName}
            onChange={(e) => setNewTaxName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTaxonomy();
            }}
          />
          <DialogFooter>
            <Button
              onClick={handleCreateTaxonomy}
              disabled={creatingTax || !newTaxName.trim()}
              size="sm"
            >
              {creatingTax && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建并分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Taxonomy Dialog */}
      <Dialog
        open={renameTaxDialog.open}
        onOpenChange={(open) => {
          setRenameTaxDialog((prev) => ({ ...prev, open }));
          if (!open) setRenameTaxName("");
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>
              重命名「{renameTaxDialog.item?.name}」
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="输入新名称"
            value={renameTaxName}
            onChange={(e) => setRenameTaxName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameTaxonomy();
            }}
          />
          <DialogFooter>
            <Button
              onClick={handleRenameTaxonomy}
              disabled={renamingTax || !renameTaxName.trim()}
              size="sm"
            >
              {renamingTax && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet — for L/S, Position Amount, and read-only details */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedPosition?.nameCn || selectedPosition?.nameEn}
            </SheetTitle>
            <SheetDescription>{selectedPosition?.tickerBbg}</SheetDescription>
          </SheetHeader>

          {selectedPosition && (
            <div className="space-y-4 p-4">
              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Market:</span>{" "}
                  {selectedPosition.market}
                </div>
                <div>
                  <span className="text-muted-foreground">PE 2026:</span>{" "}
                  {selectedPosition.pe2026.toFixed(1)}x
                </div>
                <div>
                  <span className="text-muted-foreground">PE 2027:</span>{" "}
                  {selectedPosition.pe2027.toFixed(1)}x
                </div>
                <div>
                  <span className="text-muted-foreground">Topdown:</span>{" "}
                  {selectedPosition.topdown?.name ?? "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Sector:</span>{" "}
                  {selectedPosition.sector?.name ?? "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Theme:</span>{" "}
                  {selectedPosition.theme?.name ?? "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  {selectedPosition.priority || "-"}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Long / Short</Label>
                  <Select value={editLongShort} onValueChange={setEditLongShort}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="/">/</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>持仓金额 (USD)</Label>
                  <Input
                    type="number"
                    value={editPositionAmount}
                    onChange={(e) => setEditPositionAmount(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleSheetSave}
                  disabled={saving}
                  className="w-full"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
