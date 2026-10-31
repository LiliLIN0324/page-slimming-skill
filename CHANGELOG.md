# Changelog

## 0.1.0 — 2026-11-01

首个公开版本。在一个 Astro + Cloudflare Pages 站点上端到端验证：字体子集、响应式封面、运行时延后与缓存头全部上线后，用同一脚本复测冷/热访问。

- **`scripts/measure-page.mjs`**：用本机 Chrome + DevTools Protocol 测 FCP / LCP / DCL / load、按字体/图片/脚本/样式分类的字节、最大资源；支持冷/热缓存、手机/桌面，`--direct` 绕过系统代理。跨域资源未开 `Timing-Allow-Origin` 时会明确提示用 `content-length` 补算。
- **`scripts/covers.mjs`**：用 Sharp 批量切多档 WebP、生成 48px LQIP 与清单；按原图宽度自动去掉过大的档位，记录压缩前后字节。
- **`scripts/subset-fonts.py`**：按站内实际用字生成字体子集；字符集不变时跳过；按字符集内容哈希更新 `?v=`，不按日期；列出字体本身缺少的符号。
- **`scripts/check-fonts.mjs`**：构建前漏字守卫，新增文案缺字时自动重跑子集，避免新字静默回退系统字体。
- **8 条硬规则**（`AGENTS.md`）：真实线路冷访问、一次只动最大项、LCP 图不懒加载、断点整块不下发、漏字守卫、内容哈希双处同步、运行时首屏零请求、生产验证缓存头、线路与体积分开报告。
- **接线片段**（`references/recipes.md`）：LQIP 替换、当前+下一张预取、隐藏断点、字体 preload 同步、Rive 延后、`_headers` 模板与验收命令。
- **实测数据写进 README**：字体 506KB → 171KB/字重；封面 3.36MB → 208KB；首屏运行时 1MB → 0 请求；模拟手机网络 load 9.2s → 3.96s；回访资源 0 下载。
- **多 agent 通用**：`AGENTS.md` 通用入口 + `CLAUDE.md` / `GEMINI.md` 指向；中英双版 README。

---

## 0.1.0 — 2026-11-01

First public release. Validated end to end on an Astro + Cloudflare Pages site: after font subsets, responsive covers, deferred runtime and cache headers went live, cold and warm visits were re-measured with the same script.

- **`scripts/measure-page.mjs`**: local Chrome + DevTools Protocol; FCP / LCP / DCL / load, bytes by font/image/script/style, largest resources; cold or warm cache, phone or desktop, `--direct` bypasses the system proxy. Warns when cross-origin resources hide their bytes without `Timing-Allow-Origin`.
- **`scripts/covers.mjs`**: Sharp-based responsive WebP variants, 48px LQIP and a manifest; skips widths larger than the source and records before/after bytes.
- **`scripts/subset-fonts.py`**: subsets fonts to the characters actually used; skips when the character set is unchanged; versions URLs by a content hash of the character set, never by date; lists symbols the font itself lacks.
- **`scripts/check-fonts.mjs`**: prebuild guard; new copy that needs missing characters triggers a re-subset instead of silently falling back to a system font.
- **Eight hard rules** (`AGENTS.md`): cold visit on a real route, one biggest pile at a time, no lazy-loading the LCP image, hidden breakpoints download nothing, missing-glyph guard, content-hash version in both places, zero runtime requests on the first screen, verify headers in production, report route and page weight separately.
- **Wiring recipes** (`references/recipes.md`): LQIP swap, preloading current + next, hidden breakpoints, synchronized font preload, deferred Rive, `_headers` template and acceptance commands.
- **Measured numbers in README**: fonts 506KB → 171KB per weight; cover 3.36MB → 208KB; first-screen runtime 1MB → 0 requests; simulated mobile load 9.2s → 3.96s; repeat visit 0 asset downloads.
- **Agent-agnostic**: `AGENTS.md` universal entry plus `CLAUDE.md` / `GEMINI.md` pointers; bilingual README.
