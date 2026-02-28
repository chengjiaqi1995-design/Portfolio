import Database from "better-sqlite3";

const db = new Database("dev.db");

let AUM = 100_000_000;
try {
    const aumRow = db.prepare("SELECT value FROM Settings WHERE key='aum'").get();
    if (aumRow) AUM = parseFloat(JSON.parse(aumRow.value));
} catch (e) { }

const rows = db.prepare("SELECT * FROM Position WHERE longShort IN ('long', 'short')").all();

let totalLong = 0;
let totalShort = 0;
let longCount = 0;

for (const p of rows) {
    const weight = p.positionAmount / AUM;
    if (p.longShort === "long") {
        totalLong += weight;
        longCount++;
    } else {
        totalShort -= Math.abs(weight);
    }
}

console.log({
    AUM,
    longCount,
    shortCount: rows.length - longCount,
    totalLongRaw: totalLong,
    totalShortRaw: totalShort,
    nmv: totalLong + totalShort,
    gmv: totalLong + Math.abs(totalShort)
});

// also check with names
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

const rowsWithNames = db.prepare(POSITIONS_SELECT + " WHERE p.longShort IN ('long', 'short')").all();
console.log("Rows with names count:", rowsWithNames.length);
