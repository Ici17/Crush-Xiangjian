# 香水库扩容：48 → 110 支

## 目标
从 50 支将香水库扩至 100+

## 完成内容

### 1. 生成工具
- 创建 `scripts/generate_batch.cjs` — 内置 INGREDIENT_MAP 校验（substring 匹配模式，与引擎一致）
- 写入 60 支真实香水数据（国产中文名 + 真品牌 + 合理三段香调）

### 2. 数据覆盖
- 6 维香型分布：Fresh(10) / Floral(10) / Woody(10) / Oriental(10) / Gourmand(10) / Citrus(5) + Unique(5)
- 品牌覆盖：Jo Malone, Diptyque, Byredo, Hermès, Tom Ford, Dior, Chanel, YSL, Le Labo, Guerlain, MFK, Kilian 等
- 所有使用香料均已在 `INGREDIENT_MAP` 的 212 个关键词覆盖范围内

### 3. 导入验证
- CSV → `import-perfumes.ts` → `lib/perfumes.extra.ts`（62 条：2 旧 + 60 新）
- 6 个冲突 id（白茶/大地/蔚蓝/旷野/超级雪松/墨水）已加品牌后缀去重
- **零向量：0 / 弱向量：0 / 未映射香料：0**
- **覆盖健康度：110/110 支有有效向量**

### 4. 构建验证
- Next.js 16.2.10 build 通过（Compiled in 9s, TypeScript in 21s）
- 6 路由编译成功：`/` `/question` `/result` `/friend` `/api/pay`

## 文件变更
| 文件 | 变更 |
|------|------|
| `scripts/generate_batch.cjs` | 新增：60支香水生成器 + INGREDIENT_MAP 校验 |
| `scripts/perfumes_batch.csv` | 新增：60支香水 CSV 数据 |
| `scripts/perfumes.csv` | 更新：62 条目（2旧+60新） |
| `lib/perfumes.extra.ts` | 更新：62 支香水配置 |

## 待决策
- 下一步：需要将部分新香水与 16 人格显式关联（目前仅用于余弦匹配池，未绑定人格推荐）
