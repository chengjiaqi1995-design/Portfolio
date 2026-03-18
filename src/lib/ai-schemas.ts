import { z } from "zod";

// --- Portfolio Analysis Schema ---

export const portfolioAnalysisSchema = z.object({
  executiveSummary: z
    .string()
    .describe("2-3 sentence overall portfolio assessment in Chinese"),
  riskAssessment: z.object({
    overallRiskLevel: z
      .enum(["low", "moderate", "elevated", "high"])
      .describe("Overall portfolio risk level"),
    concentrationRisk: z
      .string()
      .describe("Analysis of position concentration risk"),
    marketExposure: z
      .string()
      .describe("Net/gross exposure commentary"),
    correlationRisk: z
      .string()
      .describe("Cross-position correlation concerns"),
  }),
  sectorAllocation: z.object({
    analysis: z.string().describe("Current sector allocation assessment"),
    overweights: z
      .array(z.string())
      .describe("Sectors that appear overweight"),
    underweights: z
      .array(z.string())
      .describe("Sectors that appear underweight"),
    recommendations: z
      .array(z.string())
      .describe("Specific rebalancing suggestions"),
  }),
  topPositions: z
    .array(
      z.object({
        name: z.string(),
        observation: z.string(),
      })
    )
    .describe("Commentary on the largest positions"),
  hedgingSuggestions: z
    .array(
      z.object({
        suggestion: z.string(),
        rationale: z.string(),
      })
    )
    .describe("Specific hedging ideas"),
  keyRisks: z
    .array(
      z.object({
        risk: z.string(),
        mitigation: z.string(),
      })
    )
    .describe("Top portfolio-level risks and mitigations"),
  actionItems: z
    .array(z.string())
    .describe("Prioritized next steps"),
});

export type PortfolioAnalysis = z.infer<typeof portfolioAnalysisSchema>;

// --- Position Analysis Schema ---

export const positionAnalysisSchema = z.object({
  summary: z
    .string()
    .describe("1-2 sentence position summary in Chinese"),
  fundamentalAssessment: z.object({
    businessQuality: z.string().describe("Assessment of business quality"),
    competitivePosition: z
      .string()
      .describe("Competitive positioning analysis"),
    growthOutlook: z.string().describe("Growth prospects assessment"),
    managementQuality: z
      .string()
      .describe("Management team assessment"),
  }),
  valuationOpinion: z.object({
    currentValuation: z
      .string()
      .describe("Assessment of current PE and valuation metrics"),
    historicalContext: z
      .string()
      .describe("Historical valuation context"),
    relativeValue: z
      .string()
      .describe("Valuation relative to peers"),
    fairValueRange: z
      .string()
      .describe("Estimated fair value range"),
  }),
  riskFactors: z
    .array(
      z.object({
        factor: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        description: z.string(),
      })
    )
    .describe("Key risk factors for this position"),
  catalysts: z
    .array(
      z.object({
        catalyst: z.string(),
        timeframe: z.string(),
        impact: z.enum(["positive", "negative"]),
      })
    )
    .describe("Upcoming catalysts"),
  positionSizing: z.object({
    currentWeight: z
      .string()
      .describe("Commentary on current position weight"),
    recommendedAction: z.enum(["increase", "maintain", "reduce", "exit"]),
    rationale: z.string().describe("Rationale for the recommendation"),
  }),
});

export type PositionAnalysis = z.infer<typeof positionAnalysisSchema>;
