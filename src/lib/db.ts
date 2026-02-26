import Database from "better-sqlite3";
import path from "path";

// Database file is at project root (where prisma config puts it)
const dbPath = path.join(process.cwd(), "dev.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    // Ensure AppSettings table exists
    _db.exec(`
      CREATE TABLE IF NOT EXISTS AppSettings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    _db.prepare("INSERT OR IGNORE INTO AppSettings (key, value) VALUES ('aum', '10000000')").run();
  }
  return _db;
}

export function getAum(): number {
  const row = queryOne<{ value: string }>("SELECT value FROM AppSettings WHERE key = 'aum'");
  return row ? parseFloat(row.value) : 10_000_000;
}

// ============ Generic helpers ============

export function queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params || [])) as T[];
}

export function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params || [])) as T | undefined;
}

export function run(sql: string, params?: unknown[]) {
  return getDb().prepare(sql).run(...(params || []));
}

// ============ Type definitions ============

export interface TaxonomyRow {
  id: number;
  type: string;
  name: string;
  parentId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionRow {
  id: number;
  tickerBbg: string;
  nameEn: string;
  nameCn: string;
  market: string;
  sectorId: number | null;
  themeId: number | null;
  topdownId: number | null;
  priority: string;
  longShort: string;
  marketCapLocal: number;
  marketCapRmb: number;
  profit2025: number;
  pe2026: number;
  pe2027: number;
  priceTag: string;
  positionAmount: number;
  positionWeight: number;
  marketCapDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  sectorName?: string;
  themeName?: string;
  topdownName?: string;
}

export interface NameMappingRow {
  id: number;
  bbgName: string;
  chineseName: string;
  positionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeRow {
  id: number;
  status: string;
  note: string;
  createdAt: string;
  executedAt: string | null;
}

export interface TradeItemRow {
  id: number;
  tradeId: number;
  tickerBbg: string;
  name: string;
  transactionType: string;
  gmvUsdK: number;
  unwind: number; // SQLite boolean
  reason: string;
  positionId: number | null;
  createdAt: string;
}

export interface ResearchRow {
  id: number;
  positionId: number;
  strategy: string;
  tam: string;
  competition: string;
  valueProposition: string;
  longTermFactors: string;
  outlook3to5y: string;
  businessQuality: string;
  trackingData: string;
  valuation: string;
  revenueDownstream: string;
  revenueProduct: string;
  revenueCustomer: string;
  profitSplit: string;
  leverage: string;
  peerComparison: string;
  costStructure: string;
  equipment: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportHistoryRow {
  id: number;
  importType: string;
  fileName: string;
  recordCount: number;
  newCount: number;
  updatedCount: number;
  createdAt: string;
}

// ============ Position queries with joins ============

const POSITIONS_SELECT = `
  SELECT p.*,
    s.name as sectorName,
    th.name as themeName,
    td.name as topdownName
  FROM Position p
  LEFT JOIN Taxonomy s ON p.sectorId = s.id
  LEFT JOIN Taxonomy th ON p.themeId = th.id
  LEFT JOIN Taxonomy td ON p.topdownId = td.id
`;

export function getAllPositions(filters?: { longShort?: string; search?: string }): PositionRow[] {
  let sql = POSITIONS_SELECT;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.longShort) {
    conditions.push("p.longShort = ?");
    params.push(filters.longShort);
  }
  if (filters?.search) {
    conditions.push("(p.nameCn LIKE ? OR p.nameEn LIKE ? OR p.tickerBbg LIKE ?)");
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY ABS(p.positionAmount) DESC";

  return queryAll<PositionRow>(sql, params);
}

export function getPositionById(id: number): PositionRow | undefined {
  return queryOne<PositionRow>(POSITIONS_SELECT + " WHERE p.id = ?", [id]);
}

// ============ Transform helpers ============

/** Convert flat PositionRow (with joined names) to the nested format the frontend expects */
export function toPositionWithRelations(row: PositionRow) {
  const makeTaxonomy = (id: number | null, name: string | undefined, type: string) =>
    id ? { id, type, name: name || "", parentId: null, sortOrder: 0 } : null;

  return {
    id: row.id,
    tickerBbg: row.tickerBbg,
    nameEn: row.nameEn,
    nameCn: row.nameCn,
    market: row.market,
    sectorId: row.sectorId,
    themeId: row.themeId,
    topdownId: row.topdownId,
    priority: row.priority,
    longShort: row.longShort,
    marketCapLocal: row.marketCapLocal,
    marketCapRmb: row.marketCapRmb,
    profit2025: row.profit2025,
    pe2026: row.pe2026,
    pe2027: row.pe2027,
    priceTag: row.priceTag,
    positionAmount: row.positionAmount,
    positionWeight: row.positionWeight,
    marketCapDate: row.marketCapDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sector: makeTaxonomy(row.sectorId, row.sectorName, "sector"),
    theme: makeTaxonomy(row.themeId, row.themeName, "theme"),
    topdown: makeTaxonomy(row.topdownId, row.topdownName, "topdown"),
  };
}

export interface SnapshotRow {
  id: number;
  tradeId: number;
  positionsJson: string;
  note: string;
  createdAt: string;
}

// ============ Summary computation ============

export interface SummaryByDimension {
  name: string;
  long: number;
  short: number;
  nmv: number;
  gmv: number;
}

export function getPortfolioSummary() {
  const AUM = getAum();

  const activePositions = queryAll<PositionRow>(
    "SELECT * FROM Position WHERE longShort IN ('long', 'short')"
  );

  let totalLong = 0;
  let totalShort = 0;
  let longCount = 0;
  let shortCount = 0;
  const watchlistCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE longShort = '/'")?.c || 0;

  const byRegionMap = new Map<string, SummaryByDimension>();
  const byIndustryMap = new Map<string, SummaryByDimension>();
  const byThemeMap = new Map<string, SummaryByDimension>();

  // Get taxonomy names for each position
  const positionsWithNames = queryAll<PositionRow>(
    POSITIONS_SELECT + " WHERE p.longShort IN ('long', 'short')"
  );

  for (const p of positionsWithNames) {
    const weight = p.positionAmount / AUM;

    if (p.longShort === "long") {
      totalLong += weight;
      longCount++;
    } else {
      totalShort -= Math.abs(weight); // short is negative
      shortCount++;
    }

    const signedWeight = p.longShort === "long" ? weight : -Math.abs(weight);

    // By region
    const region = p.market || "其他";
    if (!byRegionMap.has(region)) byRegionMap.set(region, { name: region, long: 0, short: 0, nmv: 0, gmv: 0 });
    const r = byRegionMap.get(region)!;
    if (p.longShort === "long") r.long += weight; else r.short -= Math.abs(weight);
    r.nmv = r.long + r.short;
    r.gmv = r.long + Math.abs(r.short);

    // By industry (sector)
    const sector = p.sectorName || "其他";
    if (!byIndustryMap.has(sector)) byIndustryMap.set(sector, { name: sector, long: 0, short: 0, nmv: 0, gmv: 0 });
    const s = byIndustryMap.get(sector)!;
    if (p.longShort === "long") s.long += weight; else s.short -= Math.abs(weight);
    s.nmv = s.long + s.short;
    s.gmv = s.long + Math.abs(s.short);

    // By theme (topdown)
    const theme = p.topdownName || "Others";
    if (!byThemeMap.has(theme)) byThemeMap.set(theme, { name: theme, long: 0, short: 0, nmv: 0, gmv: 0 });
    const t = byThemeMap.get(theme)!;
    if (p.longShort === "long") t.long += weight; else t.short -= Math.abs(weight);
    t.nmv = t.long + t.short;
    t.gmv = t.long + Math.abs(t.short);
  }

  return {
    aum: AUM,
    totalLong,
    totalShort,
    nmv: totalLong + totalShort,
    gmv: totalLong + Math.abs(totalShort),
    longCount,
    shortCount,
    watchlistCount,
    byRegion: [...byRegionMap.values()].sort((a, b) => b.gmv - a.gmv),
    byIndustry: [...byIndustryMap.values()].sort((a, b) => b.gmv - a.gmv),
    byTheme: [...byThemeMap.values()].sort((a, b) => b.gmv - a.gmv),
  };
}
