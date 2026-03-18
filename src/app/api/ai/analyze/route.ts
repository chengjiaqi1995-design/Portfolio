import { NextRequest, NextResponse } from "next/server";
import { streamObject } from "ai";
import { getProviderAndModel } from "@/lib/ai-providers";
import { portfolioAnalysisSchema, positionAnalysisSchema } from "@/lib/ai-schemas";
import {
  getAllPositions,
  getPositionById,
  getPortfolioSummary,
  toPositionWithRelations,
  queryOne,
  type ResearchRow,
  type PositionRow,
} from "@/lib/db";

function formatNumber(n: number, decimals = 1): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + "K";
  return n.toFixed(decimals);
}

function formatPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function buildPortfolioPrompt(customPrompt?: string): string {
  const summary = getPortfolioSummary();
  const positions = getAllPositions()
    .filter((p) => p.longShort !== "/")
    .sort((a, b) => Math.abs(b.positionAmount) - Math.abs(a.positionAmount));

  let prompt = `You are a senior portfolio manager and risk analyst. Analyze this investment portfolio and provide a comprehensive structured assessment. Use Chinese for all text output.

PORTFOLIO OVERVIEW:
- AUM: $${formatNumber(summary.aum)}
- Long Exposure: ${formatPct(summary.totalLong)} | Short Exposure: ${formatPct(summary.totalShort)}
- NMV (Net): ${formatPct(summary.nmv)} | GMV (Gross): ${formatPct(summary.gmv)}
- Long Positions: ${summary.longCount} | Short Positions: ${summary.shortCount} | Watchlist: ${summary.watchlistCount}
- Total PNL: $${formatNumber(summary.totalPnl)}

SECTOR BREAKDOWN:
${summary.bySector
  .map(
    (s) =>
      `- ${s.name}: Long ${formatPct(s.long)}, Short ${formatPct(s.short)}, NMV ${formatPct(s.nmv)}, GMV ${formatPct(s.gmv)}, PNL $${formatNumber(s.pnl)}`
  )
  .join("\n")}

INDUSTRY BREAKDOWN:
${summary.byIndustry
  .map(
    (s) =>
      `- ${s.name}: Long ${formatPct(s.long)}, Short ${formatPct(s.short)}, NMV ${formatPct(s.nmv)}`
  )
  .join("\n")}

THEME BREAKDOWN:
${summary.byTheme
  .map(
    (s) =>
      `- ${s.name}: Long ${formatPct(s.long)}, Short ${formatPct(s.short)}, NMV ${formatPct(s.nmv)}`
  )
  .join("\n")}

TOPDOWN BREAKDOWN:
${summary.byTopdown
  .map(
    (s) =>
      `- ${s.name}: Long ${formatPct(s.long)}, Short ${formatPct(s.short)}, NMV ${formatPct(s.nmv)}`
  )
  .join("\n")}

POSITIONS (sorted by absolute weight, top 30):
${positions
  .slice(0, 30)
  .map((p, i) => {
    const weight = formatPct(Math.abs(p.positionAmount) / summary.aum);
    const direction = p.longShort === "long" ? "Long" : "Short";
    const returns = [
      p.return1d !== null ? `1D:${(p.return1d! * 100).toFixed(1)}%` : "",
      p.return1m !== null ? `1M:${(p.return1m! * 100).toFixed(1)}%` : "",
      p.return1y !== null ? `1Y:${(p.return1y! * 100).toFixed(1)}%` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `${i + 1}. ${p.nameCn || p.nameEn} (${p.tickerBbg}) | ${direction} | Weight: ${weight} | PE26: ${p.pe2026 || "N/A"} | PE27: ${p.pe2027 || "N/A"} | PNL: $${formatNumber(p.pnl || 0)} | ${returns} | Sector: ${p.sectorName || "N/A"} | GIC: ${p.gicIndustry || "N/A"}`;
  })
  .join("\n")}
`;

  if (customPrompt) {
    prompt += `\nADDITIONAL CONTEXT FROM USER:\n${customPrompt}\n`;
  }

  return prompt;
}

function buildPositionPrompt(
  position: PositionRow,
  research: ResearchRow | undefined,
  aum: number,
  customPrompt?: string
): string {
  const weight = formatPct(Math.abs(position.positionAmount) / aum);
  const direction = position.longShort === "long" ? "Long" : "Short";

  let prompt = `You are a senior equity research analyst. Provide a comprehensive analysis of this position. Use Chinese for all text output.

POSITION DETAILS:
- Company: ${position.nameCn || position.nameEn} (${position.tickerBbg})
- Market: ${position.market}
- Direction: ${direction}
- Position Amount: $${formatNumber(position.positionAmount)}
- Portfolio Weight: ${weight}
- Market Cap (RMB): ${position.marketCapRmb ? formatNumber(position.marketCapRmb) : "N/A"}
- Profit 2025E: ${position.profit2025 ? formatNumber(position.profit2025) : "N/A"}
- PE 2026E: ${position.pe2026 || "N/A"}
- PE 2027E: ${position.pe2027 || "N/A"}
- PNL: $${formatNumber(position.pnl || 0)}
- Returns: 1D ${position.return1d !== null ? (position.return1d! * 100).toFixed(1) + "%" : "N/A"} | 1M ${position.return1m !== null ? (position.return1m! * 100).toFixed(1) + "%" : "N/A"} | 1Y ${position.return1y !== null ? (position.return1y! * 100).toFixed(1) + "%" : "N/A"}
- Sector: ${position.sectorName || "N/A"}
- GIC Industry: ${position.gicIndustry || "N/A"}
- Exchange Country: ${position.exchangeCountry || "N/A"}
`;

  if (research) {
    const fields = [
      ["Strategy", research.strategy],
      ["TAM", research.tam],
      ["Competition", research.competition],
      ["Value Proposition", research.valueProposition],
      ["Long-term Factors", research.longTermFactors],
      ["3-5Y Outlook", research.outlook3to5y],
      ["Business Quality", research.businessQuality],
      ["Tracking Data", research.trackingData],
      ["Valuation", research.valuation],
      ["Revenue (Downstream)", research.revenueDownstream],
      ["Revenue (Product)", research.revenueProduct],
      ["Revenue (Customer)", research.revenueCustomer],
      ["Profit Split", research.profitSplit],
      ["Leverage", research.leverage],
      ["Peer Comparison", research.peerComparison],
      ["Cost Structure", research.costStructure],
      ["Equipment", research.equipment],
      ["Notes", research.notes],
    ].filter(([, v]) => v && v.trim());

    if (fields.length > 0) {
      prompt += "\nEXISTING RESEARCH NOTES:\n";
      for (const [label, value] of fields) {
        prompt += `- ${label}: ${value}\n`;
      }
    }
  }

  if (customPrompt) {
    prompt += `\nADDITIONAL CONTEXT FROM USER:\n${customPrompt}\n`;
  }

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { mode, positionId, providerId, model, customPrompt } =
      await req.json();

    if (!providerId || !model) {
      return NextResponse.json(
        { error: "请选择 AI 模型提供商和模型" },
        { status: 400 }
      );
    }

    let modelInstance;
    try {
      modelInstance = getProviderAndModel(providerId, model);
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || "模型配置错误" },
        { status: 400 }
      );
    }

    if (mode === "portfolio") {
      const prompt = buildPortfolioPrompt(customPrompt);

      const result = streamObject({
        model: modelInstance,
        schema: portfolioAnalysisSchema,
        prompt,
        temperature: 0.3,
        ...(providerId === "deepseek" ? { mode: "json" as const } : {}),
      });

      return result.toTextStreamResponse();
    } else if (mode === "position") {
      if (!positionId) {
        return NextResponse.json(
          { error: "请选择要分析的持仓" },
          { status: 400 }
        );
      }

      const position = getPositionById(positionId);
      if (!position) {
        return NextResponse.json(
          { error: "持仓不存在" },
          { status: 404 }
        );
      }

      const research = queryOne<ResearchRow>(
        "SELECT * FROM CompanyResearch WHERE positionId = ?",
        [positionId]
      );

      const summary = getPortfolioSummary();
      const prompt = buildPositionPrompt(
        position,
        research,
        summary.aum,
        customPrompt
      );

      const result = streamObject({
        model: modelInstance,
        schema: positionAnalysisSchema,
        prompt,
        temperature: 0.3,
        ...(providerId === "deepseek" ? { mode: "json" as const } : {}),
      });

      return result.toTextStreamResponse();
    } else {
      return NextResponse.json(
        { error: "Invalid mode. Use 'portfolio' or 'position'." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { error: error.message || "分析请求失败" },
      { status: 500 }
    );
  }
}
