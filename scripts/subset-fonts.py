#!/usr/bin/env python3
"""
把站点实际用到的字收进字体子集，并给字体 URL 换上内容哈希版本号。

    python scripts/subset-fonts.py                 # 读项目根的 font-slim.json
    python scripts/subset-fonts.py --config my.json
    python scripts/subset-fonts.py --force         # 字符集没变也重跑

需要：pip install fonttools brotli
字体源文件（.ttf/.otf）放在 fontsDir 里，脚本逐个生成同名 .woff2。
字符集没变且产物齐全时直接跳过，构建不会变慢。
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

# Windows 终端默认 GBK，中文日志会变乱码；统一按 UTF-8 输出。
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except Exception:
        pass

DEFAULT_PUNCT = '（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓'
SKIP_DIRS = {'node_modules', 'dist', 'build', 'out', '.git', '.astro', '.next', '.nuxt', 'coverage'}


def load_config(path):
    with open(path, encoding='utf-8') as f:
        cfg = json.load(f)
    root = os.path.dirname(os.path.abspath(path))
    resolve = lambda p: os.path.normpath(os.path.join(root, p))
    cfg['_root'] = root
    cfg['src'] = [resolve(p) for p in cfg.get('src', ['src'])]
    cfg['fontsDir'] = resolve(cfg.get('fontsDir', 'fonts-src'))
    cfg['outDir'] = resolve(cfg.get('outDir', 'public/fonts'))
    cfg['charset'] = resolve(cfg.get('charset', 'scripts/font-charset.json'))
    cfg['versionFiles'] = [resolve(p) for p in cfg.get('versionFiles', [])]
    return cfg


def site_chars(cfg):
    exts = tuple(cfg.get('extensions', ['.astro', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.css', '.html']))
    chars = set()
    for base in cfg['src']:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for name in files:
                if name.endswith(exts):
                    with open(os.path.join(root, name), encoding='utf-8', errors='ignore') as f:
                        chars.update(f.read())
    chars.update(chr(c) for c in range(0x20, 0x7F))
    chars.update(DEFAULT_PUNCT)
    chars.update(cfg.get('extraChars', ''))
    for c in ('\n', '\r', '\t'):
        chars.discard(c)
    return ''.join(sorted(c for c in chars if ord(c) >= 0x20))


def font_files(cfg):
    files = []
    for root, dirs, names in os.walk(cfg['fontsDir']):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in sorted(names):
            if name.lower().endswith(('.ttf', '.otf')):
                files.append(os.path.join(root, name))
    return files


def version(cfg):
    text = cfg['_chars']
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]


def sync_versions(cfg):
    new_v = version(cfg)
    pat = re.compile(r'(\.woff2)\?v=[A-Za-z0-9._-]+')
    touched = []
    for target in cfg['versionFiles']:
        if not os.path.exists(target):
            print(f'[warn] 版本文件不存在：{target}')
            continue
        with open(target, encoding='utf-8') as f:
            old = f.read()
        new = pat.sub(rf'\1?v={new_v}', old)
        if new != old:
            with open(target, 'w', encoding='utf-8') as f:
                f.write(new)
            touched.append(target)
    if touched:
        print(f'字体版本号 -> {new_v}（{len(touched)} 个文件）')
    return new_v


def missing_glyphs(cfg, text):
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return
    for path in font_files(cfg):
        try:
            font = TTFont(path, fontNumber=0)
            cmap = font.getBestCmap() or {}
            absent = sorted({c for c in text if ord(c) not in cmap})
            if absent:
                print(f'[note] {os.path.basename(path)} 缺 {len(absent)} 个字符，将回退系统字体：{"".join(absent[:24])}')
            font.close()
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default='font-slim.json')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    if not os.path.exists(args.config):
        sys.exit(f'找不到配置 {args.config}，可从 font-slim.example.json 复制一份。')
    cfg = load_config(args.config)
    cfg['_chars'] = site_chars(cfg)
    text = cfg['_chars']

    fonts = font_files(cfg)
    if not fonts:
        sys.exit(f'{cfg["fontsDir"]} 下没有 .ttf/.otf。把全量字体放进去，或把 fontsDir 指向 node_modules 里的字体包。')

    os.makedirs(cfg['outDir'], exist_ok=True)

    old = None
    if os.path.exists(cfg['charset']):
        try:
            with open(cfg['charset'], encoding='utf-8') as f:
                old = json.load(f).get('chars')
        except Exception:
            old = None
    outputs = [os.path.join(cfg['outDir'], os.path.splitext(os.path.basename(p))[0] + '.woff2') for p in fonts]
    unchanged = old == text and all(os.path.exists(p) for p in outputs)

    if unchanged and not args.force:
        print(f'字符集未变（{len(text)} 个），字体跳过')
        sync_versions(cfg)
        return

    print(f'字符集：{len(text)} 个（{"强制重跑" if args.force else "有变化，重新生成"}）')
    missing_glyphs(cfg, text)

    fd, txt_path = tempfile.mkstemp(suffix='.txt')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text)
        ok = True
        for src, dst in zip(fonts, outputs):
            cmd = [
                sys.executable, '-m', 'fontTools.subset', src,
                f'--text-file={txt_path}',
                '--flavor=woff2', f'--output-file={dst}',
                '--layout-features=*', '--no-hinting', '--desubroutinize',
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            size = os.path.getsize(dst) if os.path.exists(dst) else -1
            print(('[ok]' if r.returncode == 0 else '[fail]'),
                  os.path.basename(dst), f'{size / 1024:.0f}KB')
            if r.returncode != 0:
                ok = False
                print((r.stderr or '')[:500])
        if not ok:
            sys.exit(1)
    finally:
        try:
            os.remove(txt_path)
        except OSError:
            pass

    with open(cfg['charset'], 'w', encoding='utf-8') as f:
        json.dump({'generated': datetime.date.today().isoformat(),
                   'count': len(text), 'chars': text},
                  f, ensure_ascii=False, indent=1)
    sync_versions(cfg)


if __name__ == '__main__':
    main()
