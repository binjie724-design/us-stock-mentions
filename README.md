# 小红书美股讨论提及分析工具

本项目是一个本地可运行的合规数据分析 MVP，用于分析用户自主导入的“小红书美股相关帖子和评论”数据，识别近期被频繁提及的美股股票、公司名称和股票代码，并输出 Top 20。

## 合规边界

- 不提供小红书爬虫。
- 不绕过登录、验证码、反爬、风控、访问限制或平台权限控制。
- 不使用虚假账号、代理池、浏览器指纹伪装、验证码破解、自动化登录或反检测插件。
- 当前支持 Mock 数据、CSV 导入、JSON 导入、官方 Reddit Data API/OAuth CLI connector。
- 小红书授权 API 仍是未来占位；可通过 `src/lib/dataSources.ts` 的 connector 接入。
- 分析结果只输出匿名短摘录，不展示用户名、用户 ID、主页链接等个人标识。

## 技术选型

| 领域 | 选择 | 依据 |
|---|---|---|
| 前端 | Vite + React + TypeScript | Vite 官方支持 `react-ts` 模板，适合本地工具快速开发 |
| 样式 | Tailwind CSS Vite plugin | 官方 Vite plugin，零运行时样式生成 |
| CSV / JSON | Papa Parse + 原生 JSON | Papa Parse 支持浏览器和 Node，并提供 `parse` / `unparse` |
| 图表 | Recharts | React 组件式图表库，适合 Dashboard 柱状图 |
| 校验 | Zod | TypeScript-first schema validation |
| CLI | Commander | Node CLI 命令与 option 解析 |
| 本地存储 | lowdb | Type-safe local JSON database |
| 中文处理 | Unicode NFKC normalization + 配置别名精确匹配 | MVP 优先降低误判；后续可加 `Intl.Segmenter` 或 Jieba/WASM 做泛化分词 |

## 本地运行

```bash
cd "/Users/btian/Documents/New project 3/xhs-us-stock-mentions"
npm install
npm run dev
```

打开终端显示的本地 URL，默认通常是 `http://localhost:5173`。

## 验证命令

```bash
npm run test
npm run lint
npm run build
```

## Web UI

页面包括：

| 页面 | 能力 |
|---|---|
| 数据导入 | 上传 CSV / JSON，加载 Mock 数据，直接输入 Reddit API 凭证导入，显示字段校验结果 |
| 配置 | 编辑关键词列表和股票别名映射 |
| 运行分析 | 选择时间窗口和排序方式，运行 Top 20 分析 |
| Dashboard | 查看 Top 20 表格、柱状图、筛选结果 |
| 导出 | 下载 CSV |

## CLI 使用

```bash
npm run import -- --file data/sample.csv
npm run analyse -- --window 30d --ranking weighted
npm run export -- --format csv
```

### Reddit 官方 Data API 导入

最简单的方式是在 Web UI 的“数据导入”页直接填写：

| 字段 | 说明 |
|---|---|
| `Client ID` | Reddit app client id |
| `Client Secret` | Reddit app secret，只发送到本机 API，不写入配置文件 |
| `User Agent` | Reddit 要求的应用标识 |
| `Subreddits` | 逗号分隔，例如 `stocks,investing` |
| `Query` | 搜索语句，例如 `NVDA OR TSLA OR AAPL` |
| `Limit` | 每个 subreddit/query 最多导入帖子数，最大 100 |
| `导入评论` | 默认关闭；开启后会请求帖子评论 |

点击“导入 Reddit”后，页面会调用本机 `/api/reddit/import`，导入成功后自动运行当前分析配置并跳转到 Dashboard。

可选 CLI 方式如下。

Reddit connector 只在本机 API/CLI 侧运行。界面输入的 `client_secret` 只作为本次请求发送，不写入前端 bundle、配置文件、localStorage 或本地数据库；页面刷新后需要重新输入。

需要先配置环境变量：

```bash
export REDDIT_CLIENT_ID="your_client_id"
export REDDIT_CLIENT_SECRET="your_client_secret"
export REDDIT_USER_AGENT="xhs-us-stock-mentions/0.1 by your_reddit_username"
```

导入公开 Reddit 帖子：

```bash
npm run reddit:import -- --config config/reddit_sources.json
```

覆盖 subreddit 和 query：

```bash
npm run reddit:import -- \
  --subreddits stocks,investing \
  --query "NVDA OR TSLA OR AAPL OR MSFT" \
  --limit 25
```

如需同时导入帖子下评论，显式开启：

```bash
npm run reddit:import -- \
  --subreddits stocks \
  --query "NVDA OR Nvidia" \
  --include-comments \
  --comment-limit 50
```

然后继续运行：

```bash
npm run analyse -- --window 30d --ranking weighted
npm run export -- --format csv
```

## 当前支持的数据源

| 数据源 | 状态 |
|---|---|
| Mock 示例数据 | 已支持 |
| CSV 导入 | 已支持 |
| JSON 导入 | 已支持 |
| Reddit 官方 Data API connector | 已支持，CLI/server 侧运行 |
| 小红书授权 API connector | 占位模块 |
| 直接抓取小红书 | 不支持 |
| 直接抓取 Reddit 页面 | 不支持 |

## Source Code Note

The full working project currently exists locally in this Codex workspace. The key API access code is in `src/lib/redditConnector.ts`, and the local Vite API endpoint is in `vite.config.ts`. No Reddit client secret or token is committed to the repository.

## 注意

这不是投资建议工具。输出只表示导入样本中的讨论提及频率，不代表市场走势、收益预期或买卖建议。涉及实时行情、政策、财务和投资决策时，需要使用可靠数据源重新核验。
