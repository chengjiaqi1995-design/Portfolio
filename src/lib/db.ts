import Database from "better-sqlite3";
import path from "path";

// Database file can be overridden via DB_PATH (e.g. /mnt/data/dev.db) for Cloud Run volume mounts
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "dev.db");

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

    // Robust column migration: check existence first, then add
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database) {
  const cols = db.pragma("table_info(Position)") as { name: string }[];
  const existingCols = new Set(cols.map((c) => c.name));

  const migrations: { column: string; type: string; defaultVal: string }[] = [
    { column: "gicIndustry", type: "TEXT", defaultVal: "''" },
    { column: "exchangeCountry", type: "TEXT", defaultVal: "''" },
    { column: "pnl", type: "REAL", defaultVal: "0" },
  ];

  for (const m of migrations) {
    if (!existingCols.has(m.column)) {
      db.exec(`ALTER TABLE Position ADD COLUMN ${m.column} ${m.type} DEFAULT ${m.defaultVal}`);
    }
  }
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
  gicIndustry: string;
  exchangeCountry: string;
  pnl: number;
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
    gicIndustry: row.gicIndustry,
    exchangeCountry: row.exchangeCountry,
    pnl: row.pnl,
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
  pnl: number;
}

export function getPortfolioSummary() {
  const AUM = getAum();

  const watchlistCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE longShort = '/'")?.c || 0;

  // Get taxonomy names for each position
  const positionsWithNames = queryAll<PositionRow>(
    POSITIONS_SELECT + " WHERE p.longShort IN ('long', 'short')"
  );

  // --- Step 1: Merge positions by company (nameEn) ---
  const companyMap = new Map<string, {
    signedNmv: number;
    pnl: number;
    market: string;
    sectorName: string;
    topdownName: string;
    gicIndustry: string;
    exchangeCountry: string;
  }>();

  for (const p of positionsWithNames) {
    const key = p.nameEn || p.tickerBbg; // fallback to ticker if no name
    const signedNmv = p.longShort === "long" ? p.positionAmount : -p.positionAmount;

    if (companyMap.has(key)) {
      const existing = companyMap.get(key)!;
      existing.signedNmv += signedNmv;
      existing.pnl += (p.pnl || 0);
      // Keep first non-empty values for dimensions
      if (!existing.market && p.market) existing.market = p.market;
      if (!existing.sectorName && p.sectorName) existing.sectorName = p.sectorName;
      if (!existing.topdownName && p.topdownName) existing.topdownName = p.topdownName;
      if (!existing.gicIndustry && p.gicIndustry) existing.gicIndustry = p.gicIndustry;
      if (!existing.exchangeCountry && p.exchangeCountry) existing.exchangeCountry = p.exchangeCountry;
    } else {
      companyMap.set(key, {
        signedNmv,
        pnl: p.pnl || 0,
        market: p.market || "",
        sectorName: p.sectorName || "",
        topdownName: p.topdownName || "",
        gicIndustry: p.gicIndustry || "",
        exchangeCountry: p.exchangeCountry || "",
      });
    }
  }

  // --- Step 2: Aggregate on merged companies ---
  let totalLong = 0;
  let totalShort = 0;
  let totalPnl = 0;
  let longCount = 0;
  let shortCount = 0;

  const bySectorMap = new Map<string, SummaryByDimension>();
  const byIndustryMap = new Map<string, SummaryByDimension>();
  const byThemeMap = new Map<string, SummaryByDimension>();
  const byRiskCountryMap = new Map<string, SummaryByDimension>();
  const byGicIndustryMap = new Map<string, SummaryByDimension>();
  const byExchangeCountryMap = new Map<string, SummaryByDimension>();

  for (const [, company] of companyMap) {
    const isLong = company.signedNmv >= 0;
    const weight = Math.abs(company.signedNmv) / AUM;
    const pnl = company.pnl;

    totalPnl += pnl;

    if (isLong) {
      totalLong += weight;
      longCount++;
    } else {
      totalShort -= weight; // short is negative
      shortCount++;
    }

    // Helper to add to a dimension map
    const addToDim = (map: Map<string, SummaryByDimension>, dimName: string) => {
      if (!map.has(dimName)) map.set(dimName, { name: dimName, long: 0, short: 0, nmv: 0, gmv: 0, pnl: 0 });
      const d = map.get(dimName)!;
      if (isLong) d.long += weight; else d.short -= weight;
      d.nmv = d.long + d.short;
      d.gmv = d.long + Math.abs(d.short);
      d.pnl += pnl;
    };

    // Taxonomy Dimensions
    addToDim(bySectorMap, company.market || "其他");
    addToDim(byIndustryMap, company.sectorName || "其他");
    addToDim(byThemeMap, company.topdownName || "Others");

    // Native Dimensions
    addToDim(byRiskCountryMap, company.market || "其他");
    addToDim(byGicIndustryMap, company.gicIndustry || "其他");
    addToDim(byExchangeCountryMap, company.exchangeCountry || "其他");
  }

  return {
    aum: AUM,
    totalLong,
    totalShort,
    totalPnl,
    nmv: totalLong + totalShort,
    gmv: totalLong + Math.abs(totalShort),
    longCount,
    shortCount,
    watchlistCount,
    bySector: [...bySectorMap.values()].sort((a, b) => b.gmv - a.gmv),
    byIndustry: [...byIndustryMap.values()].sort((a, b) => b.gmv - a.gmv),
    byTheme: [...byThemeMap.values()].sort((a, b) => b.gmv - a.gmv),
    byRiskCountry: [...byRiskCountryMap.values()].sort((a, b) => b.gmv - a.gmv),
    byGicIndustry: [...byGicIndustryMap.values()].sort((a, b) => b.gmv - a.gmv),
    byExchangeCountry: [...byExchangeCountryMap.values()].sort((a, b) => b.gmv - a.gmv),
  };
}
