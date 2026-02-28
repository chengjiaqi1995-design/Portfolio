import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database('./dev.db');

const rows = db.prepare("SELECT tickerBbg, nameEn, nameCn, positionAmount, longShort, market FROM Position WHERE longShort IN ('long', 'short') ORDER BY positionAmount DESC").all();

let csvString = "tickerBbg,nameEn,nameCn,positionAmount,longShort,market\n";

for (const r of rows) {
    // Basic CSV escaping
    const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    csvString += [
        escapeCsv(r.tickerBbg),
        escapeCsv(r.nameEn),
        escapeCsv(r.nameCn),
        r.positionAmount,
        r.longShort,
        escapeCsv(r.market)
    ].join(',') + '\n';
}

fs.writeFileSync(path.join(process.cwd(), 'database_export.csv'), csvString);
console.log('Saved rows to database_export.csv');
