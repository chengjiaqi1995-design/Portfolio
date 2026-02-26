/**
 * 数据迁移脚本: 使用 better-sqlite3 直接操作数据库
 * 运行方式: node scripts/seed.js
 */

const Database = require("better-sqlite3");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, "../dev.db");
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

console.log("开始数据迁移...\n");

// ======== 分类数据 ========

const TOPDOWN_TREE = {
  "偏周期": ["CAPEX-工业", "CAPEX-轨道交通", "CAPEX-矿山"],
  "偏结构": ["中国出口链", "汽车", "汽车-电池", "AI-数据中心"],
  "偏主题": [
    "电力-renewable", "电力-grid", "电力-nuclear", "电力-IPP", "电力-EPC",
    "AI-自动驾驶", "AI-机器人", "反内卷",
  ],
};

const SECTORS = [
  "基建地产链条", "电力设备", "整车", "零部件", "锂电",
  "自动化", "电力运营商", "工程机械", "两轮车", "光伏和储能",
  "矿山机械", "轨道交通", "人型机器人", "检测服务", "自动驾驶",
  "轮胎", "工业MRO", "设备租赁", "天然气管道", "数据中心散热",
  "ETF", "美国基建地产", "汽车零部件",
];

const NAME_MAPPINGS = {
  "GREAT STAR IND": "巨星科技",
  "TECHTRONIC IND": "创科实业",
  "CENTRE TESTING": "华测检测",
  "WILLIAMS": "威廉姆斯",
  "FUYAO GLASS": "福耀玻璃",
  "GENERAL MOTORS": "通用汽车",
  "AMPEREX TECH": "宁德时代",
  "SZ INOVANCE TECH": "汇川技术",
  "SHZHEN ENVICOOL": "英维克",
  "KEYENCE": "基恩士",
  "ROCKWELL AUTOMAT": "罗克韦尔",
  "MAHINDRA AND MAHINDRA": "M&M",
  "LGES": "LG ES",
  "HYUNDAI MOTOR INDIA": "印度现代",
  "GEELY AUTO": "吉利",
  "YIHEDA": "怡合达",
  "KOMATSU": "小松",
  "YUNENG": "裕能新能",
  "GE VERNOVA": "GEV",
  "HYUNDAI MOTOR": "现代汽车",
  "SUZUKI MOTOR": "铃木",
  "SIEMENS ENERGY N": "西门子能源",
  "GCL TECH": "协鑫科技",
  "COGNEX": "康耐视",
  "ACTION CONSTRUCTION EQUIPMENT": "ACCE",
  "GOODYEAR TIRE AND RUBBER": "固特异",
  "WERIDE ADR": "文远",
  "TIANGONG INT'L": "天工国际",
  "JINGSHENG MECHANICAL & ELEC": "晶盛机电",
  "TONGWEI": "通威",
  "LONGI GREEN": "隆基绿能",
  "NISSAN MOTOR": "日产",
  "HAMMOND POWER SOLUTIONS": "Hammond",
  "RENAULT": "雷诺",
  "LS ELECTRIC": "LS ELECTRIC",
  "GWMOTOR": "长城",
  "SANHUA": "三花智控",
  "SUNGROW POWER": "阳光电源",
  "NB TUOPU GROUP": "拓普集团",
  "MAZDA MOTOR": "马自达",
  "TESLA": "特斯拉",
  "STELLANTIS": "Stellantis",
  "HYOSUNG HEAVY": "Hyosung Heavy",
  "NUSCALE POWER CL A": "SMR",
  "RIVIAN AUTOMOTIVE CL A": "Rivian",
  "ZOOMLION": "中联重科",
  "HONDA MOTOR": "本田",
  "HD HYUNDAI ELECTRIC": "HD Hyundai",
  "FORTUNE ELECTRIC": "华城电机",
  "HAMMOND POWER SOLN CL A": "Hammond",
  "TOYOTA MOTOR": "丰田",
  "CHINA PETROLEUM": "中国石化",
  "CRRC": "中车",
  "ECOPROBM": "Ecopro BM",
  "BMW": "BMW",
  "TATA MOTORS": "Tata Motor",
  "LUCID GROUP": "Lucid",
  "GREAT WALL MOTOR": "长城汽车",
  "BLOOM ENERGY CL A": "BLOOM",
  "POSCO FUTURE M": "POSCO",
  "NIO-SW": "蔚来",
  "BYD COMPANY": "BYD",
  "FIRST SOLAR": "FIRST SOLAR",
  "EATON": "伊顿",
  "SAIC MOTOR": "上汽",
  "XPENG-W": "小鹏",
  "FLUENCE ENERGY CL A": "FLUENCE",
  "BYD": "BYD",
  "HORIZONROBOT-W": "地平线",
  "LEADERDRIVE": "绿的谐波",
  "LI AUTO-W": "理想汽车",
  "UBTECH ROBOTICS": "优必选",
  "SHENLING": "申菱环境",
  "PONY TESTING": "谱尼测试",
  "AIKO SOLAR": "爱旭",
  "CALB": "中创新航",
  "CHANGAN AUTO": "长安",
  "CHINA TIANYING": "中国天楹",
  "EVE ENERGY": "亿纬锂能",
  "HZ FIRST": "杭氏",
  "JINKO": "晶科",
  "VOLKSWAGEN": "大众",
  "YADEA": "雅迪",
  "SENTURY TIRE": "森麒麟",
  "WEICHAI POWER": "潍柴动力",
  "F": "福特",
  "INTCO MEDICAL": "英科医疗",
  "HANGCHA GROUP": "杭叉集团",
  "KANDENKO": "Kandenko",
  "LINDE": "Linde",
  "TZE": "中华",
  "NIO-US": "蔚来",
  "XPENG-US": "小鹏",
};

// Helper: upsert taxonomy
const upsertTaxonomy = db.prepare(`
  INSERT INTO Taxonomy (type, name, parentId, sortOrder, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(type, name) DO UPDATE SET parentId=excluded.parentId, sortOrder=excluded.sortOrder, updatedAt=datetime('now')
`);
const getTaxonomyByName = db.prepare("SELECT id FROM Taxonomy WHERE type = ? AND name = ?");

// Helper: upsert name mapping
const upsertNameMapping = db.prepare(`
  INSERT INTO NameMapping (bbgName, chineseName, createdAt, updatedAt)
  VALUES (?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(bbgName) DO UPDATE SET chineseName=excluded.chineseName, updatedAt=datetime('now')
`);

// Helper: upsert position
const upsertPosition = db.prepare(`
  INSERT INTO Position (tickerBbg, nameEn, nameCn, market, sectorId, topdownId, priority, longShort,
    marketCapLocal, marketCapRmb, profit2025, pe2026, pe2027, priceTag, positionAmount, positionWeight,
    createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(tickerBbg) DO UPDATE SET
    nameEn=excluded.nameEn, nameCn=excluded.nameCn, market=excluded.market,
    sectorId=excluded.sectorId, topdownId=excluded.topdownId,
    priority=excluded.priority, longShort=excluded.longShort,
    marketCapLocal=excluded.marketCapLocal, marketCapRmb=excluded.marketCapRmb,
    profit2025=excluded.profit2025, pe2026=excluded.pe2026, pe2027=excluded.pe2027,
    positionAmount=excluded.positionAmount, positionWeight=excluded.positionWeight,
    updatedAt=datetime('now')
`);

// 1. Create taxonomies
console.log("1. 创建分类数据...");

const insertTaxonomies = db.transaction(() => {
  for (const [parentName, children] of Object.entries(TOPDOWN_TREE)) {
    upsertTaxonomy.run("topdown", parentName, null, 0);
    const parent = getTaxonomyByName.get("topdown", parentName);
    for (let i = 0; i < children.length; i++) {
      upsertTaxonomy.run("topdown", children[i], parent.id, i);
    }
  }

  for (let i = 0; i < SECTORS.length; i++) {
    upsertTaxonomy.run("sector", SECTORS[i], null, i);
  }
});
insertTaxonomies();
console.log("  ✓ Topdown 主题 + 一级板块已创建");

// 2. Create name mappings
console.log("\n2. 创建名称映射...");
const insertMappings = db.transaction(() => {
  for (const [en, cn] of Object.entries(NAME_MAPPINGS)) {
    upsertNameMapping.run(en.trim(), cn);
  }
});
insertMappings();
console.log(`  ✓ ${Object.keys(NAME_MAPPINGS).length} 条映射已创建`);

// 3. Import positions from Excel
const excelPath = path.resolve(__dirname, "../data/portfolio_data.xlsx");

if (!fs.existsSync(excelPath)) {
  console.log("\n3. Excel文件未找到，跳过持仓导入。");
  console.log(`   期望路径: ${excelPath}`);
} else {
  console.log("\n3. 读取Excel文件...");
  const workbook = XLSX.readFile(excelPath);
  const mainSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (mainSheet) {
    const allData = XLSX.utils.sheet_to_json(mainSheet, { header: 1, defval: null });

    // Find stock list header row
    let stockStartRow = -1;
    for (let i = 0; i < Math.min(allData.length, 50); i++) {
      const row = allData[i];
      if (!row) continue;
      // Look for "long/short" in col 9
      if (String(row[9] || "").includes("long/short")) {
        stockStartRow = i + 1;
        break;
      }
    }

    if (stockStartRow < 0) {
      stockStartRow = 39; // Fallback
      console.log("  未找到表头，从第40行开始");
    } else {
      console.log(`  持仓数据从第 ${stockStartRow + 1} 行开始`);
    }

    // Build lookup maps
    const allTaxonomies = db.prepare("SELECT id, type, name FROM Taxonomy").all();
    const sectorMap = {};
    const topdownMap = {};
    for (const t of allTaxonomies) {
      if (t.type === "sector") sectorMap[t.name] = t.id;
      if (t.type === "topdown") topdownMap[t.name] = t.id;
    }

    let importCount = 0;
    const insertPositions = db.transaction(() => {
      for (let i = stockStartRow; i < allData.length; i++) {
        const row = allData[i];
        if (!row) continue;

        const tickerBbg = row[7];
        const company = row[8];
        if (!tickerBbg || !company || typeof tickerBbg !== "string") continue;
        if (tickerBbg.trim() === "") continue;

        const priority = String(row[0] || "").trim();
        const topdownName = String(row[1] || "").trim();
        const sectorName = String(row[3] || "").trim();
        const market = String(row[4] || "").trim();
        const nameEn = String(row[5] || row[6] || "").trim();
        const longShortRaw = String(row[9] || "/").trim();
        const marketCapLocal = typeof row[10] === "number" ? row[10] : 0;
        const marketCapRmb = typeof row[11] === "number" ? row[11] : 0;
        const profit2025 = typeof row[12] === "number" ? row[12] : 0;
        const pe2027 = typeof row[13] === "number" ? row[13] : 0;
        const pe2026 = typeof row[15] === "number" ? row[15] : 0;
        const positionAmount = typeof row[16] === "number" ? row[16] : 0;
        const positionWeight = typeof row[17] === "number" ? row[17] : 0;

        // Resolve Chinese name
        let nameCn = company;
        for (const [key, value] of Object.entries(NAME_MAPPINGS)) {
          if (nameEn.toUpperCase().includes(key.toUpperCase()) ||
              company.toUpperCase().includes(key.toUpperCase())) {
            nameCn = value;
            break;
          }
        }

        const sectorId = sectorMap[sectorName] || null;
        const topdownId = topdownMap[topdownName] || null;
        const longShort = (longShortRaw === "long" || longShortRaw === "short") ? longShortRaw : "/";

        try {
          upsertPosition.run(
            tickerBbg.trim(), nameEn || company, nameCn, market,
            sectorId, topdownId, priority, longShort,
            marketCapLocal, marketCapRmb, profit2025, pe2026, pe2027,
            positionAmount, positionWeight
          );
          importCount++;
        } catch (e) {
          // Skip invalid
        }
      }
    });
    insertPositions();
    console.log(`  ✓ 导入 ${importCount} 只股票`);
  }
}

// 4. Summary
const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN longShort = 'long' THEN 1 ELSE 0 END) as longs,
    SUM(CASE WHEN longShort = 'short' THEN 1 ELSE 0 END) as shorts,
    SUM(CASE WHEN longShort = '/' THEN 1 ELSE 0 END) as watchlist
  FROM Position
`).get();
const taxCount = db.prepare("SELECT COUNT(*) as c FROM Taxonomy").get().c;
const mapCount = db.prepare("SELECT COUNT(*) as c FROM NameMapping").get().c;

console.log("\n========== 迁移完成 ==========");
console.log(`分类: ${taxCount} 条`);
console.log(`名称映射: ${mapCount} 条`);
console.log(`持仓总计: ${stats.total} 只`);
console.log(`  - Long: ${stats.longs}`);
console.log(`  - Short: ${stats.shorts}`);
console.log(`  - 观察池: ${stats.watchlist}`);
console.log("==============================\n");

db.close();
