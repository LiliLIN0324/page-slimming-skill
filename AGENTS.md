# 轻页 · page-slimming

把「网站打开慢」变成一张可核对的字节账单：先量、再剪、同条件复测。

这份文件是**任何编码 agent** 的入口——Codex、Claude Code、Gemini CLI、Grok CLI、DeepSeek harness、Cursor、Windsurf、Aider 都按同样的方式用。Qoder 下的同名技能读 `SKILL.md`，内容一致。

## 何时使用

用户说网站/页面打开慢、首屏要更快，或点名要处理字体、图片、缓存、LCP；也可以主动在改版上线前做一次体检。

## 开工前必读

1. 先读 `SKILL.md`（完整方法、脚本参数、坑位表、验收清单）。
2. 测量用 `scripts/measure-page.mjs`，切图用 `scripts/covers.mjs`，字体用 `subset-fonts.py` + `check-fonts.mjs`，不要临场手写另一套。
3. 页面接线的可复制片段在 `references/recipes.md`。

## 不可省略的 8 条

1. **先量后剪，而且要在真实线路上量。** 至少跑一次 `--mobile --direct` 冷缓存；localhost、热缓存、开着代理的数字都不能用来下结论。国内测国内访问必须 `--direct`。
2. **一次只动最大的那一项。** 按「字节 × 是否首屏必需」排序，改完立刻用同一脚本、同一线路复测，再动下一项。一口气全改，等于没有证据。
3. **LCP 图不懒加载，隐藏断点整块不下发。** 首屏大图用真实 `src` + `fetchpriority="high"`；手机不该看到的桌面图，隐藏整个容器并只留 `data-src`，不能只加 `display:none` 到 `img` 上还留着真实 `src`。
4. **字体子集必须配构建前守卫。** 新增文案后直接构建，`check-fonts.mjs` 要能发现漏字、自动重跑子集；字体本身没有的符号要列出来并接受回退，不能静默缺字。
5. **字体版本号用内容哈希，两处同步。** `?v=` 取字符集 `sha1` 前 8 位，不按日期；preload 与 CSS 的 URL 必须由同一个脚本更新，否则会下载两份字体。
6. **重运行时首屏 0 请求。** Rive / three / 视频 / 物理引擎延后到滚动、悬停、聚焦或点开面板；保留静态兜底；启动函数幂等；`prefers-reduced-motion` 下不加载。
7. **缓存规则要能在生产验证。** 哈希资源与带版本号的字体一年 immutable；未哈希的小图最多一周；HTML 回源校验。用 `curl -I` 查生产域名，不拿本地 dev server 当证据。
8. **报告分开「体积」与「线路」。** 页面优化只对字节和请求负责；边缘节点、跨境 RTT、运营商拥塞要单独说明，不能把线路慢算成改版成果。

## 流程

```bash
# 1. 量（真实线路、冷缓存）
node scripts/measure-page.mjs https://example.com --mobile  --direct
node scripts/measure-page.mjs https://example.com --desktop --direct

# 2. 看前三名：font / image / script 哪一类最大，谁最晚结束
# 3. 切图
npm i -D sharp
node scripts/covers.mjs --config covers.json

# 4. 字体（改 font-slim.json 的路径后）
python scripts/subset-fonts.py --config font-slim.json
node scripts/check-fonts.mjs            # prebuild 时自动执行

# 5. 延后重运行时，接线片段见 references/recipes.md

# 6. 生产缓存头
curl -sI https://example.com/fonts/site.woff2?v=abc123 | grep -i cache-control
curl -sI https://example.com/ | grep -i cache-control

# 7. 复测（冷/热 × 手机/桌面）
node scripts/measure-page.mjs https://example.com --mobile --direct --warm
```

## 报告模板

```
结论：最大头是 <资源>，从 <改前> 到 <改后>
├── 体检：TTFB / FCP / LCP / load + 前三资源字节
├── 改了什么：逐项写前后字节与请求数
├── 复测：冷/热 × 手机/桌面，同线路同脚本
├── 回归：滚动、滑卡、面板、其他页面、缓存头
└── 剩余瓶颈：线路 / 三方脚本 / 未哈希资源 / …
```

## 边界

- 只做性能，不改文案、设计与功能；要删内容或换风格，先单独确认。
- 不承诺国内打开速度：`*.pages.dev` 等域名的落地节点不受页面控制。
- 不为了分数牺牲首屏体验：LCP 图不懒加载、HTML 不长缓存、关键 CSS 不闪屏。
- 不擅自动域名、DNS、CDN 套餐或备案。
- 切图/上传前确认版权与个人信息，不把私有素材传到公共桶。

## 文件

```
SKILL.md                    完整指南（必读）
AGENTS.md                   本文件：通用入口
scripts/measure-page.mjs    同条件测量
scripts/covers.mjs          响应式 WebP + LQIP + 清单
scripts/subset-fonts.py     字体子集 + 版本号
scripts/check-fonts.mjs     漏字守卫
references/recipes.md       接线、预取、延后、缓存头片段
font-slim.example.json      字体配置样例
covers.example.json         切图配置样例
```

依赖：Node 18+、本机 Chrome、Python 3.10+（fonttools + brotli）、Sharp（只有切图时需要）。
