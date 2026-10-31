<div align="center">

# 轻页 · page-slimming

**把网站首屏做快，不靠感觉，靠改前改后的同一把尺**

先量字节，再动最大的那一项 · 图片、字体、运行时、缓存四步 · 每步都有数字验收

[![version](https://img.shields.io/badge/version-0.1.0-111111?style=flat-square)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](LICENSE)
[![node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](#技术栈与依赖)
[![chrome](https://img.shields.io/badge/Chrome-system-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#技术栈与依赖)
[![python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)](#技术栈与依赖)
[![stars](https://img.shields.io/github/stars/LiliLIN0324/page-slimming-skill?style=social)](https://github.com/LiliLIN0324/page-slimming-skill/stargazers)

[快速开始](#快速开始) · [实测数据](#实测数据) · [术语对照](#术语对照) · [技术栈](#技术栈与依赖) · [English](README.en.md)

</div>

---

## 它解决什么

「网站打开有点慢」通常卡在三件事上：

1. **不知道慢在哪。** 本地打开很快，发给别人却要转几秒；打开开发者工具，资源列表一大片，看不出该先删谁。
2. **一改就出问题。** 字体裁小了，新加一行字变成系统字体；图片压了，手机上还是一样糊、一样慢；动画延后了，按钮点开却不动。
3. **改完没法证明。** 凭感觉说「好像快了」，换个网络、换台设备，结论就反过来。

轻页把这件事变成一条可复现的流水线：**在同一条网络、同一种屏幕上量一次 → 按字节分堆 → 只动最大的一堆 → 用同一把尺复测**。图片、字体、动画、缓存各有固定做法，每一步都有改前改后的数字。

## 它是怎么干活的

一句话：**先算账，再裁剪。**

1. **量。** 用本机 Chrome 打开页面，记下「第一次看到内容」「最大内容出现」「全部加载完」三个时间，以及每个资源下载了多少字节。首次访问和回访分开测，手机和桌面分开测。
2. **分堆。** 把首屏下载分成字体、图片、脚本、样式四堆，按字节排序。大多数中文网站的第一名是字体，第二名是封面原图。
3. **剪。** 只动第一名：能不下发就不下发（手机不下桌面图），必须下发就晚一点（滑到再取），一定要下发就压小（WebP、字体子集）。动画运行时首屏一个请求都不发。
4. **缓存。** 给带哈希的文件设一年缓存，给 HTML 设「每次问一下」；回访时资源几乎零下载。
5. **复测。** 同一台机器、同一条线路、同一个脚本，再量一次；数字没变好就不算改完。

## 实测数据

在一个 Astro + Cloudflare Pages 的站点上端到端跑过一遍。数字来自同一台机器、同一条国内直连线路（Cloudflare 落点洛杉矶），会随线路和时段波动。

| 项目 | 改前 | 改后 |
|---|---|---|
| 中文字体，单字重 | 506KB | **171KB**（−66%） |
| 三个字重合计 | ~1.5MB | **~513KB** |
| 封面示例（3.36MB 原图） | 3.36MB | **208KB** @1920 WebP（−94%） |
| 首屏动画运行时 | ~1MB，打开即下载 | **滚动前 0 请求** |
| 模拟手机网络，全部加载完 | 9.2s | **3.96s**（−57%） |
| 国内直连首次打开，手机 / 桌面 | — | 看到内容 **1.3s / 1.6s** |
| 国内直连首次打开，全部完成 | — | **2.5s / 4.3s** |
| 首屏流量，手机 / 桌面 | — | **约 0.75MB / 0.9MB** |
| 回访（有缓存） | 和首次差不多 | 看到内容 **0.3s**，资源 **0 下载**，完成 **0.6s** |

> 改前数字来自同一站点的改版前后对比；「国内直连」是 2026-11 的典型采样，不代表所有省份/运营商。同一条线晚高峰拥堵时，首屏 `load` 会从 2.5 秒涨到 8 秒左右，但 FCP 仍在 2 秒级——线路慢与页面重是两件事，报告里会分开说。

## 特点

| | |
|---|---|
| **先量后剪** | 不看分数，看字节和请求；每次只动最大的一项，改完立刻复测 |
| **图片三件事** | 按屏宽切档、48px 模糊占位、滑到再取；手机不会拿到桌面大图 |
| **字体不漏字** | 只收站内用字；构建前守卫发现新文案自动补字；字体本身缺的符号会列出来 |
| **版本不打架** | 字体 URL 用内容哈希，preload 与 CSS 一起更新，不会下载两份 |
| **动画不挡首屏** | Rive / three / 视频延后到滚动、悬停或点开面板；静态兜底先顶上 |
| **回访近零下载** | 哈希资源一年缓存；HTML 每次校验；回访从 4 秒级降到 0.6 秒级 |
| **不绑框架** | Astro / Next / Vue / 纯 HTML 都能接；示例给了 Astro 和原生 JS |
| **有验收清单** | 手机断点、LQIP 摘除、滚动无空白、其他页面无回归，逐条可查 |

## 术语对照

| 术语 | 大白话 | 在这里干什么 |
|---|---|---|
| TTFB | 第一字节到达的时间 | 判断「线路」还是「服务器/页面」慢 |
| FCP | 屏幕上第一次出现内容 | 用户感知的「开始打开」 |
| LCP | 首屏最大的一块内容出现 | 用户感知的「差不多能看了」 |
| load | 所有资源都下载完 | 常被预取的下一张图拖长，不能单独当标准 |
| LQIP | 一张 48px 的模糊小图，先占位 | 大图没到时不让版面空着 |
| woff2 | 网页专用的压缩字体格式 | 字体子集的输出格式 |
| 子集 | 只把用到的字打进字体 | 中文全量字体 3–10MB，子集后 170KB 量级 |
| immutable | 告诉浏览器「这个地址永远不变」 | 哈希文件名/带版本号字体才配用 |
| CDN / R2 | 放静态资源的地方 | 图片切好后放这里，带长缓存 |
| 内容哈希 | 用内容算出的短串，放在 URL 上 | 内容变了地址就变，缓存自动失效 |

## 快速开始

**要求**：Node.js 18+、本机 Chrome、Python 3.10+（`pip install fonttools brotli`）；切图需要 `npm i -D sharp`。

```bash
git clone https://github.com/LiliLIN0324/page-slimming-skill.git
cd page-slimming-skill
```

### 1. 先量一次

```bash
# 国内测国内访问：--direct 绕过本机代理
node scripts/measure-page.mjs https://你的站点 --mobile --direct
node scripts/measure-page.mjs https://你的站点 --desktop --direct
```

看输出里的字体 / 图片 / 脚本字节和最大的几个资源，写下前三名。

### 2. 切图

```bash
cp covers.example.json covers.json   # 改成自己的图片列表
node scripts/covers.mjs --config covers.json
```

会得到多档 WebP、48px 模糊占位和一份清单。页面怎么接，见 [references/recipes.md](references/recipes.md)。

### 3. 字体

```bash
cp font-slim.example.json font-slim.json   # 改 fontsDir / versionFiles
python scripts/subset-fonts.py --config font-slim.json
```

在 `package.json` 加上：

```json
{
  "scripts": {
    "prebuild": "node scripts/check-fonts.mjs",
    "fonts": "python scripts/subset-fonts.py --config font-slim.json"
  }
}
```

以后加文案直接构建，守卫会自动补字并更新版本号。

### 4. 复测

```bash
node scripts/measure-page.mjs https://你的站点 --mobile --direct
node scripts/measure-page.mjs https://你的站点 --mobile --direct --warm
```

冷访问看「改了多少」，热访问看「缓存有没有生效」。

## 工作方式

```
        ┌──────────────┐
        │ 真实线路冷访问 │  FCP / LCP / load + 分类字节
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │ 按字节分四堆  │  字体 / 图片 / 脚本 / 样式
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │ 只动第一名    │  不下发 → 晚下发 → 压小
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │ 同条件复测    │  冷/热 × 手机/桌面
        └──────┬───────┘
               ↓
        还有第二名？──是──→ 回到「只动第一名」
               │否
               ↓
            收工，写报告
```

**为什么不用分数当唯一标准？** Lighthouse 的满分模拟的是实验室网络和固定机型；换个运营商、晚高峰、国外落地，体验完全不同。分数适合发现明显问题，判断改版效果要用同一线路的实测字节和耗时。

**为什么不把所有图都懒加载？** 首屏最大的图如果也懒加载，LCP 会更晚。首屏大图直接给真实地址并提高优先级，懒加载只用于下一屏。

**为什么字体不干脆换 CDN？** 中文字体的问题首先是体积（一个全量字重几 MB），不是位置。子集把体积降到 1/3，再谈缓存和线路才有意义。

**为什么 HTML 不长缓存？** 页面内容会变。长缓存 HTML 会让用户很长时间看不到新版；HTML 回源校验只多一次很轻的请求。

**为什么版本号不用日期？** 同一天生成两次，日期版本号不变，而缓存是 immutable 的，浏览器会继续用旧字体。用字符集的内容哈希，内容一变地址就变。

## 技术栈与依赖

| 层 | 用什么 | 为什么是它 |
|---|---|---|
| 运行环境 | Node.js 18+ | 18+ 自带全局 `fetch`；测量与切图脚本只用内置模块 + Sharp |
| 测量 | 本机 Chrome + DevTools Protocol（`scripts/measure-page.mjs`） | 不装 Playwright/Puppeteer；拿到的是真实浏览器的资源计时，而不是估算 |
| 切图 | [Sharp](https://sharp.pixelplumbing.com/) | libvips 封装，批量切 WebP 快、内存稳；`npm i -D sharp` 即可 |
| 字体 | Python + fontTools + brotli | `fontTools.subset` 是字体子集的事实标准；woff2 压缩需要 brotli |
| 缓存 | 各托管平台的 headers 配置 | 不引入运行时；规则写在部署配置里，`curl -I` 就能验 |
| 页面 | 框架无关（Astro 示例） | 优化的是资源与加载顺序，不绑定任何框架 |

**不需要**登录、不需要云账号；只有上传 CDN 时才用到你现有的对象存储。

## 在任何 agent 里用

不绑定 Qoder。仓库根目录有 `AGENTS.md`（通用入口）和 `SKILL.md`（完整指南），任何能跑命令、能开浏览器、能改文件的 agent 都能照做：Codex、Claude Code、Gemini CLI、Grok CLI、DeepSeek harness、Cursor、Windsurf、Aider……

**最省事的方式**——克隆到任意位置，然后对 agent 说：

```bash
git clone https://github.com/LiliLIN0324/page-slimming-skill.git
```

> 读 `page-slimming-skill/AGENTS.md`，给 <你的站点> 做一次首屏瘦身，先量再改。

**装成技能**（自动触发，不用每次指路）：

| Agent | 安装位置 |
|---|---|
| Qoder | `~/.qoder/skills/page-slimming` |
| Claude Code | `~/.claude/skills/page-slimming` |
| 其他 | 放进你的 agent 读取的规则/技能目录 |

```bash
# 以 Qoder 为例
mkdir -p ~/.qoder/skills
cp -r page-slimming-skill ~/.qoder/skills/page-slimming
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$HOME\.qoder\skills" | Out-Null
Copy-Item -Recurse page-slimming-skill "$HOME\.qoder\skills\page-slimming"
```

重开会话或执行 `/skills reload`，然后用 `/page-slimming` 调用。

**项目级**：把 `AGENTS.md`、`SKILL.md`、`scripts/` 放进你的项目，agent 打开项目就会读到。

## 目录

```
page-slimming-skill/
├── SKILL.md                    完整指南
├── AGENTS.md                   通用入口 + 8 条硬规则
├── CLAUDE.md / GEMINI.md       指向 AGENTS.md
├── README.md / README.en.md    中文 / English
├── CHANGELOG.md
├── scripts/
│   ├── measure-page.mjs        冷/热、手机/桌面测量
│   ├── covers.mjs              WebP 多档 + LQIP + 清单
│   ├── subset-fonts.py         字体子集 + 内容哈希版本号
│   └── check-fonts.mjs         构建前漏字守卫
├── references/
│   └── recipes.md              接线、预取、延后、缓存头
├── font-slim.example.json
├── covers.example.json
├── package.json
└── LICENSE
```

## 常见坑（完整版在 SKILL.md）

| 现象 | 原因 | 处理 |
|---|---|---|
| 字体下载两份 | preload 与 CSS 的版本号不一致 | 一个脚本同时改两处 |
| 改了字还是旧字体 | 版本号按日期，immutable 不刷新 | 用字符集内容哈希 |
| 手机上还是大图 | 只隐藏了 `img`，真实 `src` 还在 | 隐藏整个容器，只留 `data-src` |
| 图一直模糊 | 换图后没移除模糊样式 | 加载成功时摘掉 `is-lqip` |
| `load` 很久 | 预取的下一张图也会被等待 | 看 LCP 与首屏图到位时间 |
| 跨域资源 0 字节 | 对方没开 `Timing-Allow-Origin` | 用 `curl -I` 的 `content-length` |
| 缓存头本地对、线上不对 | 只在本地验证 | 到生产域名复验 |
| 测速忽快忽慢 | 走了代理或国际出口拥堵 | `--direct`，多测几次取中位数 |

## 边界与注意

- **只做性能**，不改文案、设计、功能。要删内容或换视觉风格，先单独确认。
- **不承诺国内打开速度**：`*.pages.dev` 这类域名的落地节点不受页面控制；线路问题要单独说明。
- **不为了分数牺牲首屏**：首屏大图不懒加载、HTML 不长缓存、关键 CSS 不闪屏。
- **不擅自动域名、DNS、CDN 套餐或备案**，这些是站点所有者的决定。
- 切图与上传前确认版权和个人信息，不把私有素材传到公共桶。

## 版本

当前 **0.1.0**：首个公开版本。四个脚本（测量、切图、字体子集、漏字守卫）、8 条硬规则、接线片段与验收清单，均在一个真实站点上端到端验证。

完整改动见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)

<div align="center">

如果这个 skill 帮你把「好像快了点」变成「改前 9.2 秒、改后 4 秒」，点个 Star 就是最好的支持。

</div>
