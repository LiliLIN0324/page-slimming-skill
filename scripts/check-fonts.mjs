#!/usr/bin/env node
/**
 * 构建前守卫：站点里出现的每个字，字体子集里都要有。
 * 缺字时自动重跑 subset-fonts.py；这样以后新增文案不会悄悄回退成系统字体。
 *
 *   node scripts/check-fonts.mjs                  # 缺字就补
 *   node scripts/check-fonts.mjs --check-only     # 只检查，不改文件
 *   node scripts/check-fonts.mjs --config font-slim.json
 *
 * 没配 font-slim.json 时直接跳过（没有做字体子集的项目不需要这一步）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const configPath = path.resolve(argVal('--config', 'font-slim.json'));
const checkOnly = args.includes('--check-only');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', '.git', '.astro', '.next', '.nuxt', 'coverage']);
const PUNCT = '（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓';

if (!fs.existsSync(configPath)) {
  console.log('[skip] 没有 font-slim.json，跳过字体覆盖检查');
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const base = path.dirname(configPath);
const resolve = (p) => path.resolve(base, p);
const srcDirs = (cfg.src || ['src']).map(resolve);
const extSet = new Set(cfg.extensions || ['.astro', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.css', '.html']);
const charsetPath = resolve(cfg.charset || 'scripts/font-charset.json');

function siteChars() {
  const chars = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (extSet.has(path.extname(entry.name))) {
        for (const c of fs.readFileSync(path.join(dir, entry.name), 'utf8')) chars.add(c);
      }
    }
  };
  for (const dir of srcDirs) if (fs.existsSync(dir)) walk(dir);
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const c of PUNCT + (cfg.extraChars || '')) chars.add(c);
  for (const c of ['\n', '\r', '\t']) chars.delete(c);
  return chars;
}

function bakedChars() {
  if (!fs.existsSync(charsetPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(charsetPath, 'utf8'));
  return new Set(manifest.chars || '');
}

const wanted = siteChars();
let baked = bakedChars();
if (!baked) {
  console.log(`没有字符集清单 ${path.relative(process.cwd(), charsetPath)}，先运行一次字体子集`);
} else {
  const missing = [...wanted].filter((c) => !baked.has(c));
  if (!missing.length) {
    console.log(`[ok] 字体覆盖完整（${wanted.size} 个字符）`);
    process.exit(0);
  }
  console.log(`字体子集缺少 ${missing.length} 个新用字：${missing.slice(0, 40).join('')}`);
}

if (checkOnly) {
  console.error('只检查模式：请先运行 npm run fonts / python scripts/subset-fonts.py');
  process.exit(1);
}

try {
  execFileSync(process.env.PYTHON || 'python', [
    path.join(base, 'scripts', 'subset-fonts.py'), '--config', configPath,
  ], { cwd: base, stdio: 'inherit' });
} catch (e) {
  console.error('自动补字失败。需要本机 Python + fonttools + brotli；也可以手动运行 npm run fonts。');
  process.exit(1);
}

baked = bakedChars();
const stillMissing = [...wanted].filter((c) => !baked?.has(c));
if (stillMissing.length) {
  console.error(`重新生成后仍缺字：${stillMissing.slice(0, 40).join('')}`);
  process.exit(1);
}
console.log('[ok] 字体已自动补齐');
