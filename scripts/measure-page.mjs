#!/usr/bin/env node
/**
 * 同条件冷/热访问测量：FCP / LCP / DCL / load、按类别字节、逐资源耗时。
 * 走 Chrome DevTools Protocol，不依赖 puppeteer；自带 Chrome 即可。
 *
 *   node scripts/measure-page.mjs https://example.com --mobile --direct
 *   node scripts/measure-page.mjs https://example.com --desktop --warm
 *   node scripts/measure-page.mjs https://example.com --json
 *
 * 冷缓存 = 每次都当第一次打开；热缓存 = 同一浏览器先访问一次，再测第二次。
 * --direct 绕过系统代理，测的是本机真实线路（在国内测国内访问必须加）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--') && /^https?:\/\//.test(a));
if (!url) {
  console.error('用法：node scripts/measure-page.mjs <url> [--mobile|--desktop] [--warm] [--json] [--direct] [--chrome <path>] [--screenshot <file>]');
  process.exit(2);
}
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const desktop = flag('--desktop');
const warm = flag('--warm');
const jsonOut = flag('--json');
const W = desktop ? 1440 : 390;
const H = desktop ? 900 : 844;
const MOBILE = !desktop;
const WAIT_AFTER_LOAD = Number(value('--wait', 2500));

function findChrome() {
  const explicit = value('--chrome', process.env.CHROME_PATH);
  if (explicit) return explicit;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'chrome';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tempRoot = path.join(os.tmpdir(), `page-slimming-${process.pid}`);
const profile = path.join(tempRoot, 'profile');
fs.mkdirSync(profile, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const chromeArgs = [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--hide-scrollbars',
  `--window-size=${W},${H}`,
  'about:blank',
];
if (flag('--direct')) chromeArgs.unshift('--no-proxy-server');

const chrome = spawn(findChrome(), chromeArgs, { stdio: 'ignore' });
chrome.on('error', (e) => {
  console.error(`启动 Chrome 失败：${e.message}\n用 --chrome <路径> 或设置 CHROME_PATH 指定浏览器。`);
  process.exit(1);
});

let ws;
try {
  let list;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list?.some((t) => t.type === 'page')) break;
    } catch {}
  }
  const target = list?.find((t) => t.type === 'page');
  if (!target) throw new Error('Chrome 没有就绪');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  let loaded = false;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const cb = pending.get(msg.id);
    if (cb) {
      pending.delete(msg.id);
      cb(msg);
    }
    if (msg.method === 'Page.loadEventFired') loaded = true;
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })).result?.result?.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: !warm });
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: MOBILE ? 3 : 1, mobile: MOBILE,
  });
  if (MOBILE) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__lcp = 0; window.__lcpEl = '';
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.startTime < window.__lcp) continue;
          window.__lcp = e.startTime;
          const el = e.element;
          window.__lcpEl = el ? el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().replace(/\\s+/g, '.') : '') : '';
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });`,
  });

  const navigate = async (targetUrl) => {
    loaded = false;
    await send('Page.navigate', { url: targetUrl });
    const started = Date.now();
    while (!loaded && Date.now() - started < 45000) await sleep(100);
    await sleep(WAIT_AFTER_LOAD);
  };

  // 热缓存：先完整访问一次，再测第二次；资产走缓存，HTML 仍会回源校验。
  if (warm) {
    await navigate(url);
    const second = new URL(url);
    second.searchParams.set('page-slimming-warm', String(Date.now()));
    await navigate(second.toString());
  } else {
    await navigate(url);
  }

  const data = await evaluate(`(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: r.name,
      short: r.name.replace(/^https?:\\/\\//, '').slice(0, 110),
      type: r.initiatorType || 'other',
      bytes: Math.round(r.transferSize || 0),
      encoded: Math.round(r.encodedBodySize || 0),
      start: Math.round(r.startTime),
      end: Math.round(r.responseEnd),
    }));
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      ttfb: Math.round(nav.responseStart || 0),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: Math.round(window.__lcp || 0),
      lcpEl: window.__lcpEl || '',
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      resources: res,
      origin: location.origin,
    };
  })()`);

  // 先看扩展名：字体由 CSS 触发，initiatorType 会是 "css"；只按 initiator 分会算进样式表。
  const category = (r) => {
    if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.name)) return 'font';
    if (/\.(png|jpe?g|webp|avif|svg|gif|ico)(\?|$)/i.test(r.name)) return 'image';
    if (/\.(m?js)(\?|$)/i.test(r.name) || r.type === 'script') return 'script';
    if (/\.css(\?|$)/i.test(r.name) || r.type === 'css' || r.type === 'link') return 'style';
    if (r.type === 'img' || r.type === 'image') return 'image';
    if (r.type === 'font') return 'font';
    if (r.type === 'fetch' || r.type === 'xmlhttprequest') return 'fetch';
    return r.type || 'other';
  };

  const groups = {};
  let crossOriginHidden = 0;
  let cached = 0;
  for (const r of data.resources) {
    const key = category(r);
    groups[key] ||= { bytes: 0, count: 0 };
    groups[key].bytes += r.bytes;
    groups[key].count += 1;
    const sameOrigin = r.name.startsWith(data.origin);
    if (r.bytes === 0 && r.encoded > 0 && sameOrigin) cached += 1;
    if (r.bytes === 0 && r.encoded === 0 && !sameOrigin) crossOriginHidden += 1;
  }
  const bytes = data.resources.reduce((a, r) => a + r.bytes, 0);
  const result = {
    url,
    mode: `${desktop ? 'desktop 1440x900' : 'mobile 390x844'} · ${warm ? 'warm cache' : 'cold cache'}${flag('--direct') ? ' · direct' : ''}`,
    ttfb: data.ttfb,
    fcp: data.fcp,
    lcp: data.lcp,
    lcpEl: data.lcpEl,
    dcl: data.dcl,
    load: data.load,
    requests: data.resources.length,
    bytes,
    groups,
    cached,
    crossOriginHidden,
    top: [...data.resources].sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  };

  if (flag('--screenshot')) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(value('--screenshot'), Buffer.from(shot.result.data, 'base64'));
  }

  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    console.log(`\n${url}`);
    console.log(`模式：${result.mode}`);
    console.log(`TTFB ${result.ttfb}ms · FCP ${result.fcp ?? '-'}ms · LCP ${result.lcp}ms${result.lcpEl ? ` (${result.lcpEl})` : ''} · DCL ${result.dcl}ms · load ${result.load}ms`);
    console.log(`资源计时可见字节：${kb(bytes)} · ${result.requests} 个请求`);
    for (const [name, g] of Object.entries(groups).sort((a, b) => b[1].bytes - a[1].bytes)) {
      console.log(`  ${name.padEnd(8)} ${kb(g.bytes).padStart(8)}  ${g.count} 个`);
    }
    if (cached) {
      console.log(`  ${cached} 个同源资源命中缓存（字节计为 0）`);
    }
    if (crossOriginHidden) {
      console.log(`  ⚠ ${crossOriginHidden} 个跨域资源未暴露字节（缺 Timing-Allow-Origin），需配合 curl -I 的 content-length 补算`);
    }
    console.log('最大的资源：');
    for (const r of result.top) {
      console.log(`  ${kb(r.bytes).padStart(8)}  ${String(r.start).padStart(5)}→${String(r.end).padStart(5)}ms  ${r.type.padEnd(8)} ${r.short}`);
    }
    console.log('');
  }
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(500);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
