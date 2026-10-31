---
name: page-slimming
description: 给已有网站做首屏瘦身：先在同线路、冷缓存下量 FCP/LCP/load 与各资源字节，再按大头处理——响应式图片 + LQIP + 滑到再加载、字体子集 + 漏字守卫 + 内容哈希、重运行时（Rive/three/视频）延后、缓存头；最后冷/热同条件复测。Use when a site feels slow on first visit, or when asked to 优化加载速度/首屏/LCP/字体太大/图片太大/缓存. 触发词：页面瘦身、首屏慢、打开慢、加载慢、性能优化、LCP、字体子集、图片压缩、缓存头、Rive 延迟、matter-js。
when_to_use: 用户说网站/页面打开慢、首屏要更快，或要按体积裁剪字体、图片、运行时与缓存策略，并验证改前改后。
argument-hint: <站点 URL 或项目路径>
---

# 轻页 · 页面首屏瘦身

把「打开有点慢」变成一张可核对的字节账单：**先量、再剪、同条件复测**。

## 核心思路

首次打开慢，钱花在四个地方。先判断是哪一种，再动手：

| 花在哪 | 典型症状 | 先动哪 |
|---|---|---|
| **字节**：首屏下发了不需要的东西 | 字体 1MB+、封面是原图、手机在下桌面图 | 不下发 → 按需 → 压缩 |
| **往返**：每个资源都要跨一次远路 | 首字节 0.6s+、字体一个个排队到 2s | 同源/预连接/合并/缓存 |
| **主线程**：大脚本和运行时抢主线程 | 白屏久、滚动卡、动画库首屏就加载 | 延后到交互 |
| **缓存**：回访还要重新下载 | 第二次打开和第一次一样慢 | 内容哈希 + 长缓存 |

优化优先级固定为：**不下发 > 晚下发 > 压得更小 > 换更近的线路**。换线路往往是最后一招，而且要先排除页面自身的问题。

## 工作流

### 0. 先量：同一线路、冷缓存、两种屏幕

```bash
# 手机首次访问（国内测国内访问时一定要加 --direct，绕过本机代理）
node scripts/measure-page.mjs https://example.com --mobile --direct

# 桌面首次访问
node scripts/measure-page.mjs https://example.com --desktop --direct

# 回访：同一浏览器先访问一次，再测第二次
node scripts/measure-page.mjs https://example.com --mobile --direct --warm
```

输出里只看四组数：

- **TTFB / FCP / LCP / DCL / load**：首字节、首次出内容、最大内容、可交互、全部完成。
- **按类别字节**：font / image / script / style 各占多少。
- **最大资源**：谁在拖时间，按字节和响应结束时间一起看。
- **跨域 0 字节的提示**：对方没开 `Timing-Allow-Origin`，浏览器不告诉你大小，用 `curl -sI <url>` 的 `content-length` 补。

再补两条命令行检查：

```bash
# 缓存头（要看生产域名，不是 localhost）
curl -sI https://example.com/fonts/site.woff2?v=abc123 | grep -i cache-control
curl -sI https://example.com/ | grep -i cache-control

# 边缘节点：CF-RAY 末尾是落点（LAX / HKG / SJC…）
curl -sI https://example.com/ | grep -i cf-ray
```

### 1. 列体检表

按「字节 × 是否首屏必需」排序，写下前三名。常见顺序是：

1. 中文字体（一个字重 300–800KB，三个字重直接 1.5MB+）
2. 封面原图（几 MB 的 PNG/JPG，实际显示只有 400×300）
3. 首屏不需要的运行时（Rive / three / 视频 / 物理引擎）

只动第一名。改完复测，再动第二名。不要一口气全改，否则说不清哪一步有效。

### 2. 图片：按断点下发，滑到再取

```bash
npm i -D sharp
node scripts/covers.mjs --config covers.json
```

脚本按宽度切 WebP（默认 960 / 1920，长图可加 2560）、生成 48px 的 LQIP 和清单 `{ lqip, widths, variants, srcBytes }`。

页面接线（以 Astro 为例，React/Vue 同理）：

```astro
<img
  src={cover.lqip}
  data-src={cover.variants[1920].url}
  data-srcset={`${cover.variants[960].url} 960w, ${cover.variants[1920].url} 1920w`}
  sizes="(max-width: 768px) 100vw, 60vw"
  width="1920" height="1080"
  loading="lazy" decoding="async"
  class="cover is-lqip"
  alt="…"
/>
```

```js
export function loadCover(img) {
  if (!img || img.dataset.coverLoaded === '1') return;
  const src = img.dataset.src;
  const srcset = img.dataset.srcset;
  if (!src && !srcset) return;
  img.dataset.coverLoaded = '1';
  if (srcset) img.setAttribute('srcset', srcset);
  if (src) img.setAttribute('src', src);
  img.classList.remove('is-lqip');   // 不摘掉，图会一直糊
}
```

```css
.cover { background-size: cover; }
.cover.is-lqip { filter: blur(12px); transform: scale(1.03); }
```

预取规则：

- **首屏大图（LCP）不要懒加载**：直接真实 `src` + `fetchpriority="high"`。
- 桌面横向章节：只预取「当前 + 下一张」；手机卡片栈：当前 + 后两张（960 宽足够）。
- 别的断点整块 `display: none`，并让图只带 `data-src`——隐藏容器里的图不会被下载。
- 观察器用 `IntersectionObserver`，触发一次就断开；不要用 `scroll` 事件轮询。

验收：滚动/滑卡时没有空白帧；手机 Network 面板里不出现 1920/2560 的桌面图。

### 3. 字体：只收站内用字，并守住以后的新字

```bash
pip install fonttools brotli
cp font-slim.example.json font-slim.json    # 改 fontsDir / 路径
python scripts/subset-fonts.py --config font-slim.json
```

`font-slim.json` 做三件事：

- 扫描 `src` 里所有文本字符 + ASCII + 标点，只把这些字打进 woff2；
- 字符集没变就跳过，构建不会变慢；
- 按字符集内容哈希更新字体 URL 的 `?v=`（`sha1(chars)[:8]`），**不要按日期**——同一天生成两次会让 immutable 缓存继续用旧字体。

把守卫挂到构建前：

```json
{
  "scripts": {
    "prebuild": "node scripts/check-fonts.mjs",
    "fonts": "python scripts/subset-fonts.py --config font-slim.json"
  }
}
```

以后新增文案直接构建：守卫发现漏字会重跑子集、更新版本号；字体本身没有的符号会列出来（例如 `↔ ♪ 🐔`），那些字回退系统字体，这是可接受且必须写明的。

三条容易忽略的约束：

1. **预加载和 CSS 里的字体 URL 必须同时更新**。只改一处，浏览器会下载两个版本。
2. **不要垫 GB2312 一级字库**。多出来的常用字会把子集从 170KB 推回 400KB+，而站内根本用不到。
3. **字体压缩只在同字重下比较**。三个字重都保留时，先把「首屏是否真的用到 Medium」量出来再决定去留。

### 4. 重运行时：首屏一个请求都不要

Rive / three / 视频 / 物理引擎这类东西，首屏一律延后：

```js
let started = false;
const start = () => {
  if (started || reduceMotion) return;
  started = true;
  import('./runtime.js').then(({ mount }) => mount(canvas));
};

// 滚出首屏、悬停、聚焦、点开面板，任一发生才启动
addEventListener('scroll', () => {
  if (scrollY > innerHeight * 0.4) start();
}, { passive: true, once: true });
button.addEventListener('pointerenter', start, { once: true });
button.addEventListener('focus', start, { once: true });
```

配套三件事：

- 留一张静态图/静态状态做兜底，运行时没到之前版面不能跳；
- 启动函数幂等，多个入口只跑一次；
- `prefers-reduced-motion` 下干脆不加载。

验收：首屏 Network 里 `.riv` / `.wasm` / 大运行时请求数为 **0**；滚动或悬停后才出现；功能（打开面板、播放）仍正常。

### 5. 缓存：让回访几乎零下载

```
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/mimi/*
  Cache-Control: public, max-age=604800
```

规则只有三条：

- **文件名带内容哈希**（构建产物）或 **URL 带内容哈希**（字体）→ 一年 `immutable`。
- **文件名不带哈希的小图** → 最多一周，不要 `immutable`。
- **HTML 永远回源校验**（`max-age=0, must-revalidate`），否则改版不生效。

生产验证，不要只看本地：

```bash
curl -sI https://example.com/fonts/site.woff2?v=abc123 | grep -i cache-control
curl -sI https://example.com/ | grep -i cache-control
```

### 6. 复测与验收

同一台机器、同一线路、同一脚本，跑改前/改后、冷/热、手机/桌面四组：

```bash
node scripts/measure-page.mjs <url> --mobile  --direct
node scripts/measure-page.mjs <url> --desktop --direct
node scripts/measure-page.mjs <url> --mobile  --direct --warm
```

验收清单：

- [ ] 首屏字节与最大三项的变化有数字；
- [ ] 手机不下载桌面断点的图片；
- [ ] 说「首屏完成」时，图和字体真的到位了（不是只看 `load`）；
- [ ] 首屏没有重运行时请求；
- [ ] 回访资源字节为 0 / 极小；
- [ ] 生产缓存头与预期一致；
- [ ] 滚动、滑卡、打开面板、其他页面无回归；
- [ ] 报告里把「体积改善」和「线路快慢」分开说。

## 实测（示例站点，2026-11）

同一台机器直连，Cloudflare 边缘落在洛杉矶；数字会随线路和时段波动，仅供参考量级。

| 项目 | 改前 | 改后 |
|---|---|---|
| 中文字体（单字重） | 506KB | 171KB（−66%） |
| 三个字重合计 | ~1.5MB | ~513KB |
| 封面示例（scendance） | 3.36MB 原图 | 208KB @1920 WebP（−94%） |
| 首屏重运行时 | ~1MB | 滚动前 0 请求 |
| 模拟手机网络下 load | 9.2s | 3.96s（−57%） |
| 国内直连首次打开（手机 / 桌面） | — | FCP 1.3s / 1.6s；load 2.5s / 4.3s |
| 首屏流量（手机 / 桌面） | — | 约 0.75MB / 0.9MB |
| 回访（有缓存） | — | FCP 0.3s；资源 0 下载；完成 0.6s |

## 常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 字体下载了两份 | preload 与 CSS 的 `?v=` 不一致 | 一个脚本同时改两处；构建前检查 |
| 同日改字后还是旧字体 | 版本号按日期生成，immutable 缓存不刷新 | 版本号改用字符集内容哈希 |
| 手机仍下载 1920 图 | 只隐藏了 `img`，或还在用真实 `src` | 隐藏整个容器 + 只留 `data-src` |
| 图一直模糊 | 替换 `src` 后没去掉 `is-lqip` | 加载成功时移除 class |
| `load` 要 4 秒以上 | 预取了下一章大图，`load` 会等它 | 报告用 LCP + 首屏图到位时间，别只看 `load` |
| 跨域图片显示 0 字节 | 对方没有 `Timing-Allow-Origin` | 用 `curl -sI` 的 `content-length` 补算 |
| 缓存头本地对、线不对 | 只在 dev server 验证 | 到生产域名用 `curl -I` 复验 |
| 子集后新文案变系统字体 | 没挂构建前漏字检查 | `prebuild` 跑 `check-fonts.mjs` |
| 有些符号始终缺 | 原字体就没有这些字形 | 列出来，接受系统回退，不要硬造 |
| 本地页面突然崩/列表空 | dev server 缓存与新 CSS 不匹配 | 重启 dev server，必要时清 `.vite` |
| 测速结果忽快忽慢 | 走了系统代理，或晚高峰国际出口拥堵 | 加 `--direct`；同条件多测几次取中位数 |
| 三个字重压完还是很大 | 每个字重都含全部界面字 | 先量首屏是否真用到，再合并或按页拆 |

## 边界

- **只做性能，不改文案、设计与功能**。要删内容、换字体风格、改交互，先单独确认。
- **不承诺国内打开速度**。`*.pages.dev` 这类域名的落地节点与线路不受页面控制；报告里必须把「体积」和「线路」分开。
- **不要为了分数牺牲首屏**：LCP 图不懒加载，HTML 不长缓存，关键 CSS 不异步到闪屏。
- **不擅自动域名、DNS、CDN 套餐、备案**。这些属于用户决策，不是优化动作。
- **素材与隐私**：切图和上传前确认版权与是否含个人信息；不要把私有素材传到公共桶。
- 图片压缩以「看不出差别」为准，不追求极限体积；每档宽度至少抽一张对照看。

## Resources

- [scripts/measure-page.mjs](scripts/measure-page.mjs) — 冷/热、手机/桌面、FCP/LCP/DCL/load、按类别字节与最大资源；`--direct` 绕过代理。
- [scripts/covers.mjs](scripts/covers.mjs) — 批量切响应式 WebP + 48px LQIP + 清单（需要 sharp）。
- [scripts/subset-fonts.py](scripts/subset-fonts.py) — 按站内用字生成字体子集、字符集清单与内容哈希版本号。
- [scripts/check-fonts.mjs](scripts/check-fonts.mjs) — 构建前漏字守卫，缺字自动补。
- [references/recipes.md](references/recipes.md) — 页面接线、预取、Rive 延后、缓存头与验收的可复制片段。
- [font-slim.example.json](font-slim.example.json) / [covers.example.json](covers.example.json) — 两份配置样例。
