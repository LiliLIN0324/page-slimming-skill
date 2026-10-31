# 接线片段

按项目栈挑需要的片段，场景按「图片 → 字体 → 运行时 → 缓存 → 验收」排列。

## 1. 图片清单

`node scripts/covers.mjs --config covers.json` 产出：

```json
{
  "project-one": {
    "lqip": "data:image/webp;base64,UklGR…",
    "widths": [960, 1920],
    "variants": {
      "960":  { "file": "project-one-960.webp",  "bytes": 41230 },
      "1920": { "file": "project-one-1920.webp", "bytes": 208114 }
    },
    "source": "assets/project-one.png",
    "srcBytes": 3359898
  }
}
```

把 `variants[w].file` 换成最终 URL（本地 `/covers/…`、R2、CDN 都行），再写进页面。

## 2. 首屏大图（LCP）

首屏大图不懒加载，直接给真实地址，并声明高优先级：

```html
<img
  src="/covers/hero-1920.webp"
  srcset="/covers/hero-960.webp 960w, /covers/hero-1920.webp 1920w, /covers/hero-2560.webp 2560w"
  sizes="(max-width: 768px) 180vh, 100vw"
  width="2560" height="1440"
  fetchpriority="high" decoding="async"
  alt="…"
/>
```

`sizes` 写错会选错档：手机上 `100vw × dpr3` 往往需要 2560 档；横滑整屏图用 `180vh` 才能覆盖高屏。

## 3. 非首屏封面 + LQIP

先准备一份清单，把 `variants[w].file` 换成本地或 CDN 地址（下面用 `variants[w].url` 表示）：

```astro
<img
  src={cover.lqip}
  data-src={cover.variants[1920].url}
  data-srcset={`${cover.variants[960].url} 960w, ${cover.variants[1920].url} 1920w`}
  sizes="(max-width: 768px) 100vw, 60vw"
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
  img.classList.remove('is-lqip');
}
```

```css
.cover { background-size: cover; background-position: center; }
.cover.is-lqip { filter: blur(12px); transform: scale(1.03); }
```

React 里把 `data-src` 换成 `data-src` / `ref` 调同一个函数；Vue 用指令在 `mounted` 调。

## 4. 预取当前 + 下一张

```js
const preload = (src) => {
  if (!src) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
};

function onSlideChange(index) {
  const order = [index, index + 1];           // 桌面：当前 + 下一张
  for (const i of order) {
    const el = slides[i]?.querySelector('img');
    if (!el) continue;
    loadCover(el);
    preload(el.dataset.src);
  }
}
```

手机卡片栈往前翻时，也预取后两张的 960 档；不要预取 1920，否则手机白耗流量。

## 5. 隐藏断点

```css
@media (max-width: 768px) {
  .desktop-runway { display: none; }
}
```

```astro
<!-- 桌面章节容器里的图只写 data-src，不写 src -->
<div class="desktop-runway">
  <img data-src={url1920} data-srcset={srcset} class="cover is-lqip" … />
</div>
```

隐藏容器里的 `<img>` 在浏览器中不会发起请求；但如果 `src` 已经写死，`display:none` 也不保证省下下载。**只给 data-src**。

## 6. 字体：CSS + preload 同源更新

```css
@font-face {
  font-family: 'Site Sans';
  src: url('/fonts/SiteSans-Regular.woff2?v=abc12345') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

```html
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="/fonts/SiteSans-Regular.woff2?v=abc12345" />
```

两处 `?v=` 由 `subset-fonts.py` 的 `versionFiles` 一起改：

```json
{
  "versionFiles": ["src/styles/global.css", "src/layouts/Base.astro"]
}
```

只预加载首屏一定会用到的字重；其余让 CSS 按需触发。

## 7. 运行时延后（Rive 示例）

```js
let rig = null;
let started = false;
let start = () => {};

const startRive = () => {
  if (started || reduceMotion) return;
  started = true;
  import('./mimi-rive.js').then(({ mountMimiRive }) =>
    mountMimiRive(canvas, reduceMotion).then((next) => {
      if (!next) return;
      rig = next;
      if (pendingAttention) rig.attention();
    }),
  );
};

// 任一入口触发，且只触发一次
addEventListener('scroll', () => {
  if (scrollY < innerHeight * 0.4) return;
  startRive();
}, { passive: true, once: true });
button.addEventListener('pointerenter', startRive, { once: true });
button.addEventListener('focus', startRive, { once: true });
```

要点：

- 静态头像/海报先显示，版面尺寸固定；
- `import()` 动态引入运行时，别在入口静态引入；
- 打开面板的行为要自己先调 `startRive()`，不能假设运行时已经在了；
- 降级：运行时加载失败就继续用静态图。

## 8. 缓存头

Cloudflare Pages（`public/_headers`）：

```
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/avatars/*
  Cache-Control: public, max-age=604800

/*
  Cache-Control: public, max-age=0, must-revalidate
```

Netlify 用 `public/_headers` 同格式；Vercel 用 `vercel.json` 的 `headers`；Nginx 用 `location` + `add_header`。要点不变：

- 哈希/带版本号 → 一年 immutable；
- 未哈希小图 → 一周；
- HTML → 回源校验。

对象存储（R2/S3/OSS）在上传时设 `Cache-Control`：

```bash
# 以 R2 + wrangler 为例
wrangler r2 object put bucket/opt/cover-1920.webp \
  --file ./cover-1920.webp \
  --content-type image/webp \
  --cache-control "public, max-age=31536000, immutable" \
  --remote
```

## 9. 验收命令

```bash
# 冷访问
node scripts/measure-page.mjs https://example.com --mobile  --direct
node scripts/measure-page.mjs https://example.com --desktop --direct

# 回访
node scripts/measure-page.mjs https://example.com --mobile  --direct --warm

# 缓存头
curl -sI https://example.com/        | grep -iE 'cache-control|cf-ray'
curl -sI https://example.com/fonts/SiteSans-Regular.woff2?v=abc12345 | grep -i cache-control

# 跨域资源拿不到字节时
curl -sI https://cdn.example.com/cover-1920.webp | grep -iE 'content-length|cache-control'
```

判断标准：

- 手机不出现桌面档图片；
- 首屏没有 `.riv/.wasm/three` 等大运行时；
- 图上屏后 `is-lqip` 被移除，无空白帧；
- 回访资源字节为 0 或只剩 HTML；
- 生产 `cache-control` 与计划一致。
