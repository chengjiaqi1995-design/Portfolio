/**
 * 数据迁移脚本: 从 汇总2.xlsb 导入数据到新系统
 *
 * 运行方式: npx tsx scripts/migrate-excel.ts
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("../src/generated/prisma/client");
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient() as any;

// ======== 分类数据 (从Excel中提取) ========

const TOPDOWN_TREE: Record<string, string[]> = {
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

// 名称映射 (从Sheet4提取)
const NAME_MAPPINGS: Record<string, string> = {
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
  "PONY AI": "Pony AI",
  "NIO-US": "蔚来",
  "XPENG-US": "小鹏",
};

async function main() {
  console.log("开始数据迁移...\n");

  // 1. 创建分类 (Taxonomy)
  console.log("1. 创建分类数据...");

  // Create topdown categories
  for (const [parentName, children] of Object.entries(TOPDOWN_TREE)) {
    const parent = await prisma.taxonomy.upsert({
      where: { type_name: { type: "topdown", name: parentName } },
      update: {},
      create: { type: "topdown", name: parentName, sortOrder: 0 },
    });
    for (let i = 0; i < children.length; i++) {
      await prisma.taxonomy.upsert({
        where: { type_name: { type: "topdown", name: children[i] } },
        update: { parentId: parent.id, sortOrder: i },
        create: { type: "topdown", name: children[i], parentId: parent.id, sortOrder: i },
      });
    }
  }
  console.log("  ✓ Topdown 主题已创建");

  // Create sectors
  for (let i = 0; i < SECTORS.length; i++) {
    await prisma.taxonomy.upsert({
      where: { type_name: { type: "sector", name: SECTORS[i] } },
      update: {},
      create: { type: "sector", name: SECTORS[i], sortOrder: i },
    });
  }
  console.log("  ✓ 一级板块已创建");

  // 2. 创建名称映射
  console.log("\n2. 创建名称映射...");
  for (const [en, cn] of Object.entries(NAME_MAPPINGS)) {
    await prisma.nameMapping.upsert({
      where: { bbgName: en.trim() },
      update: { chineseName: cn },
      create: { bbgName: en.trim(), chineseName: cn },
    });
  }
  console.log(`  ✓ ${Object.keys(NAME_MAPPINGS).length} 条映射已创建`);

  // 3. 尝试读取Excel文件导入持仓数据 (已转换为xlsx)
  const excelPath = path.resolve(__dirname, "../data/portfolio_data.xlsx");

  if (!fs.existsSync(excelPath)) {
    console.log("\n3. Excel文件未找到，跳过持仓导入。请稍后通过网页导入。");
    console.log(`   期望路径: ${excelPath}`);
  } else {
    console.log("\n3. 读取Excel文件...");
    try {
      const workbook = XLSX.readFile(excelPath);

      // Try to read the Export sheet (Sheet 3)
      const exportSheet = workbook.Sheets[workbook.SheetNames[2]]; // "Export"
      if (exportSheet) {
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(exportSheet, { defval: null });
        console.log(`  发现 ${data.length} 条Export记录`);
      }

      // Read the main sheet (Sheet 1 - index 0) for position data
      const mainSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (mainSheet) {
        const allData = XLSX.utils.sheet_to_json<Record<string, unknown>>(mainSheet, {
          header: 1,
          defval: null
        }) as unknown[][];

        // Find the stock list section (starts around row 40)
        let stockStartRow = -1;
        for (let i = 0; i < allData.length; i++) {
          const row = allData[i] as unknown[];
          if (row && row[0] === "优先级" && row[1] === "topdown主题") {
            stockStartRow = i + 1;
            break;
          }
        }

        if (stockStartRow > 0) {
          console.log(`  持仓数据从第 ${stockStartRow + 1} 行开始`);

          const taxonomies = await prisma.taxonomy.findMany();
          const sectorMap = new Map(taxonomies.filter(t => t.type === "sector").map(t => [t.name, t.id]));
          const topdownMap = new Map(taxonomies.filter(t => t.type === "topdown").map(t => [t.name, t.id]));

          let importCount = 0;

          for (let i = stockStartRow; i < allData.length; i++) {
            const row = allData[i] as unknown[];
            if (!row) continue;

            const tickerBbg = row[7] as string;
            const company = row[8] as string;
            if (!tickerBbg || !company || typeof tickerBbg !== "string") continue;

            const priority = (row[0] as string) || "";
            const topdownName = (row[1] as string) || "";
            const sectorName = (row[3] as string) || "";
            const market = (row[4] as string) || "";
            const nameEn = ((row[5] || row[6] || "") as string).trim();
            const longShort = (row[9] as string) || "/";
            const marketCapLocal = (typeof row[10] === "number" ? row[10] : 0);
            const marketCapRmb = (typeof row[11] === "number" ? row[11] : 0);
            const profit2025 = (typeof row[12] === "number" ? row[12] : 0);
            const pe2027 = (typeof row[13] === "number" ? row[13] : 0);
            const pe2026 = (typeof row[15] === "number" ? row[15] : 0);
            const positionAmount = (typeof row[16] === "number" ? row[16] : 0);
            const positionWeight = (typeof row[17] === "number" ? row[17] : 0);

            // Lookup name mapping
            let nameCn = company;
            const mapping = await prisma.nameMapping.findFirst({
              where: { bbgName: { contains: nameEn.split(" ")[0] } },
            });
            if (mapping) nameCn = mapping.chineseName;

            const sectorId = sectorMap.get(sectorName) || null;
            const topdownId = topdownMap.get(topdownName) || null;

            const ls = longShort === "long" || longShort === "short" ? longShort : "/";

            try {
              await prisma.position.upsert({
                where: { tickerBbg: tickerBbg.trim() },
                update: {
                  nameEn: nameEn || company,
                  nameCn,
                  market,
                  priority,
                  longShort: ls,
                  marketCapLocal,
                  marketCapRmb,
                  profit2025,
                  pe2026,
                  pe2027,
                  positionAmount,
                  positionWeight,
                  sectorId,
                  topdownId,
                },
                create: {
                  tickerBbg: tickerBbg.trim(),
                  nameEn: nameEn || company,
                  nameCn,
                  market,
                  priority,
                  longShort: ls,
                  marketCapLocal,
                  marketCapRmb,
                  profit2025,
                  pe2026,
                  pe2027,
                  positionAmount,
                  positionWeight,
                  sectorId,
                  topdownId,
                },
              });
              importCount++;
            } catch (e) {
              // Skip duplicates or invalid data
            }
          }
          console.log(`  ✓ 导入 ${importCount} 只股票`);
        }
      }
    } catch (e) {
      console.log(`  ⚠ Excel读取失败: ${e}`);
      console.log("  请稍后通过网页导入。");
    }
  }

  // 4. 汇总
  const posCount = await prisma.position.count();
  const taxCount = await prisma.taxonomy.count();
  const mapCount = await prisma.nameMapping.count();

  console.log("\n========== 迁移完成 ==========");
  console.log(`分类: ${taxCount} 条`);
  console.log(`名称映射: ${mapCount} 条`);
  console.log(`持仓: ${posCount} 只`);
  console.log("==============================\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("迁移失败:", e);
  prisma.$disconnect();
  process.exit(1);
});
