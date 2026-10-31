#!/usr/bin/env node
/**
 * 把封面原图切成响应式 WebP，并生成 48px 模糊占位（LQIP）清单。
 *
 *   npm i -D sharp
 *   node scripts/covers.mjs --config covers.json
 *
 * covers.json:
 * {
 *   "outDir": "public/covers",
 *   "manifest": "src/data/covers.json",
 *   "widths": [960, 1920],
 *   "quality": 72,
 *   "images": [
 *     { "slug": "xihu", "source": "assets/xihu.jpg", "widths": [960, 1920, 2560] },
 *     { "slug": "map", "source": "https://example.com/map.jpg" }
 *   ]
 * }
 *
 * 只负责切图与清单；上传 CDN 与页面接线见 references/recipes.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    config: { type: 'string', default: 'covers.json' },
    'lqip-width': { type: 'string', default: '48' },
    'lqip-quality': { type: 'string', default: '30' },
  },
});
const configPath = path.resolve(values.config);
if (!fs.existsSync(configPath)) {
  console.error(`找不到 ${values.config}，可从 covers.example.json 复制一份。`);
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const base = path.dirname(configPath);
const outDir = path.resolve(base, cfg.outDir || 'public/covers');
const manifestPath = path.resolve(base, cfg.manifest || 'src/data/covers.json');
const defaultWidths = cfg.widths || [960, 1920];
const quality = cfg.quality ?? 72;
const lqipWidth = Number(values['lqip-width']);
const lqipQuality = Number(values['lqip-quality']);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('缺少 sharp：先运行 npm i -D sharp');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

const manifest = {};
for (const item of cfg.images || []) {
  if (!item.slug || !item.source) {
    console.error('每张图都需要 slug 与 source');
    process.exit(1);
  }
  const input = /^https?:\/\//.test(item.source)
    ? Buffer.from(await (await fetch(item.source)).arrayBuffer())
    : fs.readFileSync(path.resolve(base, item.source));
  const meta = await sharp(input).metadata();
  const widths = (item.widths || defaultWidths).filter((w) => w < (meta.width || Infinity));
  if (!widths.length) widths.push(meta.width);

  const variants = {};
  for (const width of widths) {
    const file = `${item.slug}-${width}.webp`;
    const dest = path.join(outDir, file);
    const info = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toFile(dest);
    variants[width] = { file: path.basename(dest), bytes: info.size };
  }

  const lqip = await sharp(input)
    .rotate()
    .resize({ width: lqipWidth })
    .webp({ quality: lqipQuality })
    .toBuffer();
  manifest[item.slug] = {
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
    widths,
    variants,
    source: item.source,
    srcBytes: input.length,
    width: meta.width,
    height: meta.height,
  };
  const saved = 1 - variants[widths[widths.length - 1]].bytes / input.length;
  console.log(
    `${item.slug.padEnd(28)} ${String(Math.round(input.length / 1024)).padStart(6)}KB → ` +
    `${String(Math.round(variants[widths[widths.length - 1]].bytes / 1024)).padStart(5)}KB ` +
    `(${(saved * 100).toFixed(0)}% off) · LQIP ${Math.round(lqip.length / 1024)}KB`,
  );
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`\n清单：${path.relative(process.cwd(), manifestPath)}`);
