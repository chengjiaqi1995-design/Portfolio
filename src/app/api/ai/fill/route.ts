import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const { positionId, researchId } = await req.json();

        if (!positionId || !researchId) {
            return NextResponse.json({ error: "Missing positionId or researchId" }, { status: 400 });
        }

        // 1. Fetch AI Configuration
        const aiConfig = queryOne<{ value: string }[]>(
            "SELECT key, value FROM AppSettings WHERE key IN ('ai_api_key', 'ai_model', 'ai_base_url')"
        );
        // Since queryOne might not return array if wrong signature used, let's use queryAll for multiple rows usually. 
        // We already have generic helpers in db.
        const db = require('@/lib/db');
        const rows = db.queryAll("SELECT key, value FROM AppSettings WHERE key IN ('ai_api_key', 'ai_model', 'ai_base_url')");

        let apiKey = "";
        let model = "";
        let baseUrl = "";

        for (const r of rows) {
            if (r.key === 'ai_api_key') apiKey = r.value;
            if (r.key === 'ai_model') model = r.value;
            if (r.key === 'ai_base_url') baseUrl = r.value;
        }

        if (!apiKey || !model || !baseUrl) {
            return NextResponse.json({ error: "AI 配置不完整，请前往设置页面配置 Base URL, 模型 和 API Key。" }, { status: 400 });
        }

        // 2. Fetch Position Information
        const position = db.queryOne("SELECT * FROM Position WHERE id = ?", [positionId]);
        if (!position) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        const companyName = position.nameCn || position.nameEn;
        const ticker = position.tickerBbg;
        const marketInfo = position.market;

        // 3. Construct Prompt
        const systemPrompt = `You are a top-tier fundamental equity analyst. Your task is to provide structured research notes for the requested company:
Company Name: ${companyName}
Ticker: ${ticker}
Market: ${marketInfo}

Please output your response strictly in valid JSON format matching the following schema. Use concise, professional, and insightful language (in Chinese). Do not include any text outside the JSON block.

{
  "strategy": "公司策略 (公司核心发展战略/业务重心)",
  "tam": "空间 TAM (目标市场规模/渗透率)",
  "competition": "格局 (主要竞争对手/市场份额/护城河)",
  "valueProposition": "生意本质/产品价值 (解决什么痛点/核心壁垒)",
  "longTermFactors": "改变长期价值的东西 (技术变革/人口结构/政策)",
  "outlook3to5y": "3-5年以后的展望 (中期增长驱动力)",
  "businessQuality": "生意本质评估 (好生意/苦生意/ROIC水平)",
  "trackingData": "需要跟踪的核心数据 (量/价/利/相关高频宏观指标)",
  "valuation": "估值情况 (目前估值区间/历史分位数/合理估值锚)",
  "revenueDownstream": "收入拆分 - 按下游",
  "revenueProduct": "收入拆分 - 按产品",
  "revenueCustomer": "收入拆分 - 按客户",
  "profitSplit": "利润拆分 (各业务毛利/净利贡献度)",
  "leverage": "杠杆情况 (财务杠杆/经营杠杆)",
  "peerComparison": "同行对比 (优劣势/估值溢价与折价原因)",
  "costStructure": "成本结构 (固定成本vs可变成本/上游依赖)",
  "equipment": "关键设备或核心资产",
  "notes": "额外笔记或近期催化剂(Catalysts)"
}
`;

        // 4. Call LLM
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Please provide the fundamental analysis for ${companyName} (${ticker}).` }
                ],
                temperature: 0.2, // Low temperature for more analytical/factual tone
                response_format: { type: "json_object" }
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("LLM Error:", errText);
            return NextResponse.json({ error: "AI API 请求失败: " + res.status + " " + (res.statusText) }, { status: 500 });
        }

        const aiData = await res.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json({ error: "AI 返回格式异常" }, { status: 500 });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse AI output:", content);
            return NextResponse.json({ error: "AI 生成内容解析为 JSON 失败。" }, { status: 500 });
        }

        // 5. Update Database
        const updateQuery = `
      UPDATE CompanyResearch 
      SET 
        strategy = ?, tam = ?, competition = ?, valueProposition = ?,
        longTermFactors = ?, outlook3to5y = ?, businessQuality = ?, trackingData = ?,
        valuation = ?, revenueDownstream = ?, revenueProduct = ?, revenueCustomer = ?,
        profitSplit = ?, leverage = ?, peerComparison = ?, costStructure = ?,
        equipment = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND positionId = ?
    `;

        db.run(updateQuery, [
            parsed.strategy || "",
            parsed.tam || "",
            parsed.competition || "",
            parsed.valueProposition || "",
            parsed.longTermFactors || "",
            parsed.outlook3to5y || "",
            parsed.businessQuality || "",
            parsed.trackingData || "",
            parsed.valuation || "",
            parsed.revenueDownstream || "",
            parsed.revenueProduct || "",
            parsed.revenueCustomer || "",
            parsed.profitSplit || "",
            parsed.leverage || "",
            parsed.peerComparison || "",
            parsed.costStructure || "",
            parsed.equipment || "",
            parsed.notes || "",
            researchId,
            positionId
        ]);

        // return the updated data
        return NextResponse.json({ success: true, parsed });

    } catch (error: any) {
        console.error("AI Fill failed:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
