<div align="center">

# Lightpage · page-slimming

**Make a first visit fast — with the same ruler before and after**

Measure bytes first, fix the biggest pile · images, fonts, runtime, caching · every step proven by numbers

[![version](https://img.shields.io/badge/version-0.1.0-111111?style=flat-square)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](LICENSE)
[![node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](#stack-and-requirements)
[![chrome](https://img.shields.io/badge/Chrome-system-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#stack-and-requirements)
[![python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)](#stack-and-requirements)
[![stars](https://img.shields.io/github/stars/LiliLIN0324/page-slimming-skill?style=social)](https://github.com/LiliLIN0324/page-slimming-skill/stargazers)

[Quick start](#quick-start) · [Measured](#measured) · [Glossary](#glossary) · [Stack](#stack-and-requirements) · [中文 · 轻页](README.md)

</div>

---

## What it solves

"My site feels a little slow" usually gets stuck on three things:

1. **You cannot see where the time goes.** It is instant on your laptop, but someone else waits seconds. The network panel is a wall of files and nothing tells you what to cut first.
2. **Every fix breaks something.** The font gets smaller and a newly added character falls back to the system font; the images get compressed and the phone still downloads the desktop size; the animation is deferred and the button no longer opens.
3. **You cannot prove it got better.** "Feels faster" flips the other way on a different network or device.

Lightpage turns this into a repeatable pipeline: **measure on one real network and one screen → sort the first screen into piles by bytes → change only the biggest pile → re-measure with the same ruler.** Images, fonts, runtime and caching each have a fixed recipe, and each step has before/after numbers.

## How it works

In one sentence: **do the accounting first, then trim.**

1. **Measure.** Open the page in your local Chrome and record when the first content appears, when the largest content appears, when everything finishes, and how many bytes each resource downloads. First visit and repeat visit are measured separately; phone and desktop too.
2. **Sort.** Split first-screen bytes into fonts, images, scripts and styles. On most Chinese-language sites the biggest pile is fonts, and the second is cover art.
3. **Trim.** Touch only the biggest pile: if it does not need to be sent, do not send it (the phone should not get desktop images); if it is needed, send it later (load on approach); if it must be sent, make it smaller (WebP, font subsetting). A heavy animation runtime gets zero requests on the first screen.
4. **Cache.** Hashed files get a one-year cache; HTML always revalidates. A repeat visit downloads almost nothing.
5. **Re-measure.** Same machine, same route, same script. If the numbers did not improve, it is not done.

## Measured

Run end to end on an Astro + Cloudflare Pages site. All numbers come from one machine on a direct connection from China (Cloudflare edge in Los Angeles); expect variation by route and time of day.

| Item | Before | After |
|---|---|---|
| Chinese webfont, per weight | 506KB | **171KB** (−66%) |
| Three weights combined | ~1.5MB | **~513KB** |
| Cover example (3.36MB original) | 3.36MB | **208KB** @1920 WebP (−94%) |
| First-screen animation runtime | ~1MB, loaded on open | **0 requests before scroll** |
| Simulated mobile network, full load | 9.2s | **3.96s** (−57%) |
| First visit from China, phone / desktop | — | first content **1.3s / 1.6s** |
| First visit from China, fully loaded | — | **2.5s / 4.3s** |
| First-screen transfer, phone / desktop | — | **~0.75MB / 0.9MB** |
| Repeat visit (cached) | about the same as first | first content **0.3s**, **0 asset downloads**, done **0.6s** |

> Before numbers are the same site's own before/after comparison. The China numbers are a typical sample from Nov 2026, not a promise for every province or ISP. When the international route is congested at peak hours, full load can stretch from 2.5s to around 8s while first content stays in the 2-second range. Slow route and heavy page are two different problems, and reports keep them separate.

## Features

| | |
|---|---|
| **Measure first** | Not a score — bytes and requests. One pile at a time, re-measured immediately |
| **Images, three rules** | Width ladder, 48px blurred placeholder, load on approach; phones never fetch desktop sizes |
| **No missing glyphs** | Subset to characters actually used; a prebuild guard refills new copy; symbols the font lacks are reported |
| **No version drift** | Font URLs carry a content hash; preload and CSS are updated together, so no double download |
| **Animation off the critical path** | Rive / three / video start on scroll, hover or open; a static fallback holds the layout |
| **Near-zero repeat visits** | Hashed assets cached for a year; HTML revalidated; repeat visits drop from seconds to 0.6s |
| **Framework-agnostic** | Astro, Next, Vue, plain HTML; examples use Astro and vanilla JS |
| **Acceptance list** | Phone breakpoint, placeholder removal, no blank frames, no regressions, all checkable |

## Glossary

| Term | Plain meaning | What it does here |
|---|---|---|
| TTFB | Time until the first byte arrives | Tells route/server cost apart from page weight |
| FCP | First content painted | When the page starts to appear |
| LCP | Largest content painted | When the page roughly feels readable |
| load | All resources downloaded | Often stretched by the prefetched next image; never the only metric |
| LQIP | A 48px blurred thumbnail used as a placeholder | Keeps layout non-empty while the big image loads |
| woff2 | Compressed web font format | Output format of the subset |
| Subset | Keep only the characters used | Full CJK fonts are 3–10MB; subsets are ~170KB |
| immutable | "This URL will never change" | Only for hashed filenames or versioned fonts |
| CDN / R2 | Where static files live | Host the variants here with long caching |
| Content hash | A short fingerprint of the content, in the URL | Content changes → URL changes → cache refreshes |

## Quick start

**Requirements**: Node.js 18+, local Chrome, Python 3.10+ (`pip install fonttools brotli`); image variants need `npm i -D sharp`. If your interpreter is `python3`, set `PYTHON=python3`.

```bash
git clone https://github.com/LiliLIN0324/page-slimming-skill.git
cd page-slimming-skill
```

### 1. Measure once

```bash
# Measuring a China site from China: --direct bypasses your local proxy
node scripts/measure-page.mjs https://your-site --mobile --direct
node scripts/measure-page.mjs https://your-site --desktop --direct
```

Read the font / image / script totals and the largest resources; write down the top three.

### 2. Image variants

```bash
cp covers.example.json covers.json   # replace with your own images
node scripts/covers.mjs --config covers.json
```

You get WebP variants, 48px placeholders and a manifest. Wiring is in [references/recipes.md](references/recipes.md).

### 3. Fonts

```bash
cp font-slim.example.json font-slim.json   # set fontsDir / versionFiles
python scripts/subset-fonts.py --config font-slim.json
```

Add to `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/check-fonts.mjs",
    "fonts": "python scripts/subset-fonts.py --config font-slim.json"
  }
}
```

From then on, build normally after adding copy — the guard refills missing characters and bumps the version.

### 4. Re-measure

```bash
node scripts/measure-page.mjs https://your-site --mobile --direct
node scripts/measure-page.mjs https://your-site --mobile --direct --warm
```

Cold tells you what changed; warm tells you whether caching works.

## Workflow

```
        ┌──────────────────┐
        │ cold visit, real │  FCP / LCP / load + bytes by type
        │ route            │
        └────────┬─────────┘
                 ↓
        ┌──────────────────┐
        │ four piles       │  font / image / script / style
        └────────┬─────────┘
                 ↓
        ┌──────────────────┐
        │ fix the biggest  │  don't send → send later → send smaller
        └────────┬─────────┘
                 ↓
        ┌──────────────────┐
        │ same ruler again │  cold/warm × phone/desktop
        └────────┬─────────┘
                 ↓
        second biggest? ──yes──→ back to "fix the biggest"
                 │no
                 ↓
          done, write the report
```

**Why not use the score as the only ruler?** Lighthouse simulates a lab network and a fixed device. A different ISP, peak-hour congestion or a distant edge changes the experience completely. Scores are good for spotting obvious problems; judging a change needs same-route bytes and timings.

**Why not lazy-load every image?** Lazy-loading the largest first-screen image makes LCP later. The hero gets a real `src` and high priority; lazy loading is for the next screen.

**Why not just move fonts to a CDN?** The problem with CJK fonts is size (a full weight is several MB), not location. Subsetting cuts it to a third; caching and routing only matter after that.

**Why not cache HTML for a long time?** Pages change. Long-cached HTML keeps users on an old version; revalidating HTML costs one light request.

**Why not a date-based font version?** Regenerating twice in one day keeps the same version, and immutable caches keep serving the old file. A content hash changes the URL whenever the character set changes.

## Stack and requirements

| Layer | What | Why |
|---|---|---|
| Runtime | Node.js 18+ | Global `fetch` built in; scripts use built-ins plus Sharp |
| Measurement | Local Chrome + DevTools Protocol (`scripts/measure-page.mjs`) | No Playwright/Puppeteer; real browser resource timings, not estimates |
| Images | [Sharp](https://sharp.pixelplumbing.com/) | libvips wrapper; fast, memory-stable batch WebP; `npm i -D sharp` |
| Fonts | Python + fontTools + brotli | `fontTools.subset` is the de facto subsetting tool; woff2 needs brotli |
| Caching | Host platform header config | No runtime; rules live in deploy config and are verifiable with `curl -I` |
| Page | Framework-agnostic (Astro examples) | Optimizes resources and order, not a framework |

**No account or cloud service needed**; only CDN uploads use your existing object storage.

## Use it in any agent

Not tied to Qoder. The repo root has `AGENTS.md` (universal entry) and `SKILL.md` (full guide); any agent that can run commands, drive a browser and edit files can follow them: Codex, Claude Code, Gemini CLI, Grok CLI, DeepSeek harness, Cursor, Windsurf, Aider…

**Simplest** — clone anywhere, then tell the agent:

```bash
git clone https://github.com/LiliLIN0324/page-slimming-skill.git
```

> Read `page-slimming-skill/AGENTS.md` and slim the first screen of <your site>; measure before changing anything.

**Install as a skill** (auto-triggered, no path pointing):

| Agent | Install to |
|---|---|
| Qoder | `~/.qoder/skills/page-slimming` |
| Claude Code | `~/.claude/skills/page-slimming` |
| Other | Your agent's rule/skill directory |

```bash
# Qoder example
mkdir -p ~/.qoder/skills
cp -r page-slimming-skill ~/.qoder/skills/page-slimming
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$HOME\.qoder\skills" | Out-Null
Copy-Item -Recurse page-slimming-skill "$HOME\.qoder\skills\page-slimming"
```

Restart the session or run `/skills reload`, then invoke `/page-slimming`.

**Project-level**: drop `AGENTS.md`, `SKILL.md` and `scripts/` into your project; the agent reads them when it opens it.

## Layout

```
page-slimming-skill/
├── SKILL.md                    full guide
├── AGENTS.md                   universal entry + 8 hard rules
├── CLAUDE.md / GEMINI.md       point to AGENTS.md
├── README.md / README.en.md    Chinese / English
├── CHANGELOG.md
├── scripts/
│   ├── measure-page.mjs        cold/warm, phone/desktop measurement
│   ├── covers.mjs              WebP ladder + LQIP + manifest
│   ├── subset-fonts.py         font subsets + content-hash version
│   └── check-fonts.mjs         prebuild missing-glyph guard
├── references/
│   └── recipes.md              wiring, preloading, deferral, headers
├── font-slim.example.json
├── covers.example.json
├── package.json
└── LICENSE
```

## Pitfalls (full list in SKILL.md)

| Symptom | Cause | Fix |
|---|---|---|
| Font downloads twice | Preload and CSS versions differ | One script updates both |
| New copy still uses the old font | Date-based version + immutable cache | Content hash as version |
| Phone still fetches big images | Only the `img` is hidden, real `src` remains | Hide the container, keep only `data-src` |
| Images stay blurry | Placeholder class never removed | Remove `is-lqip` on load |
| `load` takes ages | The prefetched next image is awaited too | Judge by LCP and first-screen image timing |
| Cross-origin resources show 0 bytes | No `Timing-Allow-Origin` | Use `content-length` from `curl -I` |
| Cache headers right locally, wrong live | Only tested locally | Verify the production domain |
| Timings jump around | Proxy or congested international route | `--direct`; take a median of several runs |

## Boundaries

- **Performance only** — no copy, design or feature changes without a separate decision.
- **No promises about speed from China**: the edge location for `*.pages.dev` is outside the page's control; route issues are reported separately.
- **Do not trade the first screen for a score**: hero images are not lazy-loaded, HTML is not long-cached, critical CSS is not made to flash.
- **Do not change domains, DNS, CDN plans or filings** on your own; those belong to the site owner.
- Confirm rights and personal data before processing and uploading images; never push private assets to a public bucket.

## Version

**0.1.0** — first public release. Four scripts (measurement, image variants, font subsets, missing-glyph guard), eight hard rules, wiring recipes and an acceptance checklist, validated end to end on a real site.

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

<div align="center">

If this skill turns "feels a bit faster" into "9.2s before, 4s after", a Star is the best thanks.

</div>
