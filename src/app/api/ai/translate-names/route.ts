import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { bbgNames } = await req.json();

        if (!Array.isArray(bbgNames) || bbgNames.length === 0) {
            return NextResponse.json({ error: "Missing or empty bbgNames array" }, { status: 400 });
        }

        // 1. Fetch AI Configuration
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

        // 2. Construct Prompt
        const systemPrompt = `你是一个专业的金融数据翻译助手。
你需要将用户提供的一组 Bloomberg (彭博) 公司名称或 Ticker 翻译成标准的中文公司简称。

要求：
1. 必须输出合格的 JSON 对象格式。
2. JSON 的 key 为原来的英文 bbgName，value 为翻译后的中文名称。
3. 如果遇到无法识别或者没有合适中文名的，可以保留英文或者写大概的中文译名。
4. 例如输入 ["TENCENT HOLDINGS LTD", "ALIBABA GROUP HOLDING LTD"]，输出 {"TENCENT HOLDINGS LTD": "腾讯控股", "ALIBABA GROUP HOLDING LTD": "阿里巴巴"}。
不要输出其他多余的解释文字。`;

        // 3. Call LLM
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
                    { role: "user", content: JSON.stringify(bbgNames) }
                ],
                temperature: 0.1, // low temp for accurate translation
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

        let parsed: Record<string, string>;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse AI output:", content);
            return NextResponse.json({ error: "AI 生成内容解析为 JSON 失败。" }, { status: 500 });
        }

        return NextResponse.json({ success: true, mappings: parsed });

    } catch (error: any) {
        console.error("AI Translation failed:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
