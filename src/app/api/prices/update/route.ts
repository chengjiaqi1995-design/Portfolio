import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

/** Convert Bloomberg ticker to Yahoo Finance symbol.
 *  Examples:
 *    "AAPL US Equity"   → "AAPL"
 *    "3888 HK Equity"   → "3888.HK"
 *    "6902 JP Equity"   → "6902.T"
 *    "005380 KS Equity" → "005380.KS"
 *    "300274 CH Equity"  → "300274.SZ"
 *    "600104 CH Equity"  → "600104.SS"
 *    "BHP AU Equity"    → "BHP.AX"
 *    "9696 HK Equity"   → "9696.HK"
 *    "2330 TT Equity"   → "2330.TW"
 *    "500325 IN Equity"  → "500325.BO"
 *    "CNH Curncy"       → null (skip currencies)
 */
function bbgToYahoo(bbgTicker: string): string | null {
    const parts = bbgTicker.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const symbol = parts[0];
    const exchange = parts[1].toUpperCase();
    const type = (parts[2] || "").toUpperCase();

    // Skip currencies, indices, etc.
    if (type === "CURNCY" || type === "INDEX" || type === "COMDTY") return null;

    // Map Bloomberg exchange codes to Yahoo suffixes
    const exchangeMap: Record<string, string> = {
        "US": "",         // US stocks have no suffix
        "UN": "",         // NYSE
        "UQ": "",         // NASDAQ
        "UP": "",         // NYSE ARCA
        "HK": ".HK",
        "JP": ".T",       // Tokyo
        "KS": ".KS",      // Korea (KOSPI)
        "KQ": ".KQ",      // Korea (KOSDAQ)
        "AU": ".AX",      // Australia
        "TT": ".TW",      // Taiwan
        "IN": ".BO",      // India (Bombay)
        "SP": ".SI",      // Singapore
        "LN": ".L",       // London
        "GR": ".DE",      // Germany
        "FP": ".PA",      // France (Paris)
        "SM": ".MC",      // Spain (Madrid)
        "IM": ".MI",      // Italy (Milan)
        "SJ": ".JO",      // South Africa
        "SS": ".ST",      // Sweden (Stockholm)
        "SW": ".SW",      // Switzerland
        "LI": ".AS",      // Luxembourg/Amsterdam
        "NA": ".AS",      // Netherlands
        "NO": ".OL",      // Norway (Oslo)
        "DC": ".CO",      // Denmark (Copenhagen)
        "FH": ".HE",      // Finland (Helsinki)
        "PW": ".WA",      // Poland (Warsaw)
        "CN": ".TO",      // Canada (Toronto)
    };

    // China A-shares
    if (exchange === "CH" || exchange === "CS" || exchange === "CG") {
        if (/^6\d{5}$/.test(symbol)) return symbol + ".SS";
        if (/^[0-3]\d{5}$/.test(symbol)) return symbol + ".SZ";
        return symbol + ".SS";
    }

    const suffix = exchangeMap[exchange];
    if (suffix === undefined) return symbol;

    let sym = symbol.replace(/\//g, "-"); // Bloomberg uses / for share class, Yahoo uses -

    // Zero-pad numeric tickers for HK (4 digits)
    if (exchange === "HK" && /^\d+$/.test(sym)) {
        sym = sym.padStart(4, "0");
    }

    // Stockholm: Bloomberg appends share class letter (HUSQB), Yahoo uses hyphen (HUSQ-B)
    if (exchange === "SS" && /^[A-Z]+[A-Z]$/.test(sym) && sym.length > 3) {
        sym = sym.slice(0, -1) + "-" + sym.slice(-1);
    }

    return sym + suffix;
}

/** Try to fetch chart data, with a search fallback for mismatched symbols */
async function fetchChart(yahooSymbol: string, bbgTicker: string, startDate: Date, endDate: Date): Promise<any> {
    try {
        const result: any = await yahooFinance.chart(yahooSymbol, {
            period1: startDate, period2: endDate, interval: "1d",
        });
        if (result?.quotes?.length >= 2) return result;
    } catch { /* direct lookup failed, try search */ }

    // Fallback: search Yahoo for the company name from the Bloomberg ticker
    const searchTerm = bbgTicker.split(/\s+/)[0]; // e.g. "MSIL"
    try {
        const searchResult: any = await yahooFinance.search(searchTerm);
        const quotes = searchResult?.quotes;
        if (quotes?.length > 0) {
            // Pick the first equity result
            const match = quotes.find((q: any) => q.quoteType === "EQUITY") || quotes[0];
            if (match?.symbol && match.symbol !== yahooSymbol) {
                const result: any = await yahooFinance.chart(match.symbol, {
                    period1: startDate, period2: endDate, interval: "1d",
                });
                if (result?.quotes?.length >= 2) return result;
            }
        }
    } catch { /* search also failed */ }

    return null;
}

/** Calculate return for a given period */
function calcReturn(prices: { close: number; date: Date }[], daysAgo: number): number | null {
    if (prices.length < 2) return null;

    const latest = prices[prices.length - 1];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    let closest = prices[0];
    for (const p of prices) {
        if (Math.abs(p.date.getTime() - targetDate.getTime()) < Math.abs(closest.date.getTime() - targetDate.getTime())) {
            closest = p;
        }
    }

    if (closest.close === 0) return null;
    return (latest.close - closest.close) / closest.close;
}

export async function POST() {
    try {
        const positions = queryAll<{ id: number; tickerBbg: string }>(
            "SELECT id, tickerBbg FROM Position WHERE longShort IN ('long', 'short') OR (ABS(pnl) > 0)"
        );

        let updated = 0;
        let failed = 0;
        const errors: { ticker: string; error: string }[] = [];

        const batchSize = 5;
        for (let i = 0; i < positions.length; i += batchSize) {
            const batch = positions.slice(i, i + batchSize);

            const promises = batch.map(async (pos) => {
                const yahooSymbol = bbgToYahoo(pos.tickerBbg);
                if (!yahooSymbol) {
                    return { id: pos.id, ticker: pos.tickerBbg, success: false, error: "unsupported ticker type" };
                }

                try {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    startDate.setDate(startDate.getDate() - 7);

                    const result = await fetchChart(yahooSymbol, pos.tickerBbg, startDate, endDate);

                    if (!result || !result.quotes || result.quotes.length < 2) {
                        return { id: pos.id, ticker: pos.tickerBbg, success: false, error: `no data for ${yahooSymbol}` };
                    }

                    const prices = result.quotes
                        .filter((q: any) => q.close != null)
                        .map((q: any) => ({ close: q.close as number, date: new Date(q.date) }));

                    const return1d = calcReturn(prices, 1);
                    const return1m = calcReturn(prices, 30);
                    const return1y = calcReturn(prices, 365);

                    run(
                        `UPDATE Position SET return1d = ?, return1m = ?, return1y = ?, pricesUpdatedAt = datetime('now') WHERE id = ?`,
                        [return1d, return1m, return1y, pos.id]
                    );

                    return { id: pos.id, ticker: pos.tickerBbg, success: true };
                } catch (err: any) {
                    return { id: pos.id, ticker: pos.tickerBbg, success: false, error: err.message?.slice(0, 100) };
                }
            });

            const results = await Promise.all(promises);
            for (const r of results) {
                if (r.success) updated++;
                else {
                    failed++;
                    errors.push({ ticker: r.ticker, error: r.error || "unknown" });
                }
            }

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < positions.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return NextResponse.json({
            updated,
            failed,
            total: positions.length,
            errors: errors.slice(0, 20), // Only return first 20 errors
            updatedAt: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("Failed to update prices:", error);
        return NextResponse.json({ error: error.message || "Failed to update prices" }, { status: 500 });
    }
}
