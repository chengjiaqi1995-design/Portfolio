# Portfolio Manager

多空股票组合管理系统，用于管理约 $10M AUM 的对冲基金投资组合。

## 技术栈

- **框架**: Next.js 16.1.6 (App Router, Turbopack)
- **前端**: React 19, Tailwind CSS 4, shadcn/ui (Radix UI), Recharts
- **数据库**: SQLite (通过 better-sqlite3 直接访问, Prisma 仅用于 schema 定义)
- **富文本**: TipTap
- **Excel 解析**: xlsx (SheetJS)

## 启动

```bash
npm install
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 构建生产版本
npm start            # 启动生产服务器
```

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # Dashboard (首页) — 统计卡片, NMV分配图, Net Exposure图, Top10表
│   ├── positions/page.tsx  # 个股管理 — 持仓列表, 内联编辑, 排序/筛选
│   ├── trade/page.tsx      # 调仓 — 创建/执行交易
│   ├── research/page.tsx   # 公司研究 — 富文本研究笔记
│   ├── import/page.tsx     # 数据导入 — 上传 Bloomberg Export Excel
│   ├── settings/page.tsx   # 设置 — 管理分类(Taxonomy)和名称映射(NameMapping)
│   └── api/                # API 路由 (详见下方)
├── lib/
│   ├── db.ts               # 数据库连接 + 所有查询函数 + 类型定义
│   └── types.ts            # 前端共享类型
├── components/
│   ├── ui/                 # shadcn/ui 基础组件
│   └── layout/sidebar.tsx  # 侧边栏导航
└── generated/prisma/       # Prisma 生成代码 (未使用, 仅保留 schema)

prisma/
├── schema.prisma           # 数据库 Schema 定义 (8个模型)
└── dev.db                  # SQLite 数据库文件

dev.db                      # 项目根目录也有一份 (实际使用的)
```

## 数据库

SQLite 数据库, 通过 `src/lib/db.ts` 中的 better-sqlite3 直接操作。Prisma 仅用于 schema 定义, 不用于运行时查询。

### 数据模型

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| **Position** | 个股持仓 | tickerBbg, nameEn, nameCn, market, longShort, positionAmount, positionWeight, sectorId, themeId, topdownId, priority |
| **Taxonomy** | 分类标签 | type (`topdown`/`sector`/`theme`), name |
| **NameMapping** | Bloomberg名称→中文名映射 | bbgName, chineseName, positionId |
| **CompanyResearch** | 公司研究笔记 | positionId, strategy, tam, competition, valuation... (富文本HTML) |
| **Trade** | 调仓交易 | status (`pending`/`executed`/`cancelled`), note |
| **TradeItem** | 交易明细 | tradeId, tickerBbg, transactionType (`buy`/`sell`), gmvUsdK |
| **Snapshot** | 持仓快照 | tradeId, positionsJson (全量JSON) |
| **ImportHistory** | 导入记录 | importType, fileName, recordCount |
| **AppSettings** | 应用设置 | key/value 键值对, 目前存储 `aum` |

### 关键函数 (`src/lib/db.ts`)

- `getDb()` — 获取数据库连接 (单例, WAL模式, 自动创建 AppSettings 表)
- `getAum()` — 从 AppSettings 读取 AUM 值
- `queryAll<T>(sql, params)` / `queryOne<T>(sql, params)` / `run(sql, params)` — 通用查询
- `getAllPositions(filters)` — 获取持仓列表 (带 Taxonomy JOIN)
- `getPositionById(id)` — 获取单个持仓
- `toPositionWithRelations(row)` — 将数据库行转为前端格式 (嵌套 sector/theme/topdown 对象)
- `getPortfolioSummary()` — 计算组合统计 (AUM, NMV%, GMV%, 按地区/行业/主题分布)

## API 路由

### 持仓 `/api/positions`
- `GET /api/positions` — 获取所有持仓 (支持 `?longShort=long&search=xxx` 筛选)
- `GET /api/positions/[id]` — 获取单个持仓详情 (含 research 和 nameMappings)
- `PUT /api/positions/[id]` — 更新持仓字段; **priority/sectorId/themeId/topdownId 会自动传播到同一 tickerBbg 的所有持仓**
- `DELETE /api/positions/[id]` — 删除持仓

### 导入 `/api/import`
- `POST /api/import` — 上传 Bloomberg Export Excel 文件导入持仓
  - 支持两种格式: 旧版 (`NMV excl Cash & FX`) 和新版 (`Latest NMV` / `Avg NMV`)
  - 自动跳过 "Total" 汇总行和 "Applied filters" 行
  - 按 tickerBbg 匹配: 已有则更新 (nameEn/nameCn/market/longShort/positionAmount/positionWeight), 新增则创建
  - **保留用户编辑的字段**: sectorId, themeId, topdownId, priority 不会被导入覆盖
  - positionWeight = positionAmount / AUM (来自 AppSettings)

### 设置 `/api/settings`
- `GET /api/settings` — 获取设置 (`{ aum: number }`)
- `PUT /api/settings` — 更新设置 (`{ aum: number }`)

### 汇总 `/api/summary`
- `GET /api/summary` — 获取组合汇总数据 (AUM, NMV%, GMV%, Long%, Short%, 按地区/行业/主题分布)

### 分类 `/api/taxonomy`
- `GET /api/taxonomy` — 获取所有分类 (支持 `?type=sector` 筛选)
- `POST /api/taxonomy` — 创建分类 `{ type, name }`
- `PUT /api/taxonomy/[id]` — 更新分类
- `DELETE /api/taxonomy/[id]` — 删除分类

### 名称映射 `/api/name-mappings`
- `GET /api/name-mappings` — 获取所有名称映射
- `POST /api/name-mappings` — 创建映射 `{ bbgName, chineseName, positionId? }`
- `PUT /api/name-mappings/[id]` — 更新映射
- `DELETE /api/name-mappings/[id]` — 删除映射

### 公司研究 `/api/research`
- `GET /api/research/[positionId]` — 获取某持仓的研究笔记
- `PUT /api/research/[positionId]` — 更新/创建研究笔记 (所有字段为富文本HTML)

### 调仓 `/api/trades`
- `GET /api/trades` — 获取所有交易
- `POST /api/trades` — 创建交易
- `GET /api/trades/[id]` — 获取交易详情 (含 items 和 snapshot)
- `PUT /api/trades/[id]` — 更新交易; status 改为 `executed` 时自动执行交易 (更新持仓金额, 创建快照)
- `DELETE /api/trades/[id]` — 删除交易 (级联删除 items 和 snapshot)

### 导入历史 `/api/import-history`
- `GET /api/import-history` — 获取最近导入记录

## 页面功能

### Dashboard (`/`)
- 5个统计卡片: AUM (可点击编辑), NMV%, GMV%, Long%, Short%
- 3个 NMV 分配横向柱状图 (按地区/行业/主题)
- Net Exposure 分布图 (可切换维度, 点击柱子展开持仓明细)
- Top 10 Long / Short 表格

### 个股管理 (`/positions`)
- 持仓列表, 分为 "实盘持仓" 和 "观察池" 两个标签页
- **内联编辑**: Priority, Topdown, Sector, Theme 可直接在表格中通过下拉框修改, 自动保存
- **新增分类**: 下拉框底部有 "+ 新增" 选项, 可直接创建新的 Topdown/Sector/Theme
- **排序**: 点击列头排序 (Priority, Topdown, Sector, Theme, Market, L/S, Position%)
- **筛选**: 搜索框 + 市场/板块/主题/多空 筛选器
- 点击行打开侧边 Sheet 编辑 L/S 和持仓金额
- Position% 根据当前 AUM 动态计算 (`positionAmount / AUM`)

### 数据导入 (`/import`)
- 拖拽上传 Bloomberg Export Excel 文件
- 支持导入持仓数据和市值数据
- 显示导入历史记录

### 调仓 (`/trade`)
- 创建调仓交易 (买入/卖出/清仓)
- 预览、执行交易 (自动更新持仓, 创建快照)

### 公司研究 (`/research`)
- 按公司查看/编辑研究笔记
- TipTap 富文本编辑器

### 设置 (`/settings`)
- 管理 Taxonomy (Topdown主题/Sector行业/Theme主题)
- 管理 NameMapping (Bloomberg名称→中文名)

## 重要设计决策

1. **AUM 可配置**: 存储在 AppSettings 表, Dashboard 上可点击编辑, 所有百分比动态计算
2. **同 ticker 传播**: 修改 priority/sector/theme/topdown 时自动应用到同一 tickerBbg 的所有持仓
3. **导入不覆盖分类**: 用户手动编辑的 sectorId/themeId/topdownId/priority 在重新导入时保留
4. **数据库访问**: 不使用 Prisma Client, 直接用 better-sqlite3 (性能更好, 同步API)
5. **前端组件**: 全部使用 shadcn/ui, 不引入其他UI库
