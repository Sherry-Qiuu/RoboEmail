# RoboEmail 品牌标识

一张折角信纸，压上一个 R。机器切割的几何标记，配人文衬线字标——正好是这只工具在做的事：让机器写出来的信，读起来像人写的。

## 文件

| 文件 | 用途 |
| --- | --- |
| `logo-primary.svg` / `.png` | 横版主标，浅色底（网页页眉、文档、PPT） |
| `logo-primary-dark.svg` / `.png` | 横版主标，深色底 |
| `logo-primary-mono.svg` | 单色横版，用于烫印、单色印刷 |
| `logo-stacked.svg` / `.png` / `-dark.svg` | 竖版，用于方形版位、海报、头像 |
| `logo-mark.svg` / `-dark.svg` / `-mono.svg` | 只有标记，用于头像、贴纸 |
| `logo-mark-512.png` | 标记位图 |
| `app-icon.svg` / `.png` / `app-icon-square.svg` | 应用图标；`square` 为 iOS 满版，系统自己裁圆角 |
| `favicon.svg` / `.ico` / `-16.png` / `-32.png` | 浏览器标签页 |
| `apple-touch-icon.png` | iOS 主屏图标，180px |
| `og.png` | 社交分享卡，1200×630 |
| `preview.svg` / `.png` | 一页看完的规范板 |
| `fonts/newsreader-wordmark.woff2` | 字标子集，仅 9 个字母，1.6 kB |

`preview.html` 是可以在浏览器里直接打开的动态预览。

## 颜色

| 名称 | 值 | 用途 |
| --- | --- | --- |
| Sage | `#4F7A5B` | 主色：标记、字标后半段 |
| Sage Deep | `#3F6549` | 按压态、深一层的同色 |
| Sage Light | `#A8C9A6` | 深色底上的强调色 |
| Ink | `#191917` | 字标前半段、正文 |
| Paper | `#F3F3F1` | 底色、标记里的 R |

## 字体

字标为 **Newsreader**（SIL Open Font License），已转曲，不依赖系统字体。网页页眉使用同一字体的子集 `fonts/newsreader-wordmark.woff2`，与 SVG 完全对齐。

## 用法

- **最小尺寸**：标记不小于 16 px；横版主标不小于 96 px 宽。再小就只用标记，不要带字。
- **留白**：标记四周至少留出标记宽度的 1/2，不要压边。
- **深色底**：用 `-dark` 版本（纸色底 + 墨色 R），不要把浅色底那版直接放上去。
- **不要**：改 R 的比例、给标记加渐变/投影/描边、把标记裁切、拉伸，或在标记后面再加一个圆角矩形底。
- 单色印刷用 `mono` 版本；R 是镂空的，会透出承印物的颜色。

## 站点接入

- 静态资源在 `apps/web/public/brand/`，字体在 `apps/web/public/fonts/`。
- `apps/web/index.html` 已声明 favicon、apple-touch-icon、theme-color 与 Open Graph。
- 页眉标识由 `apps/web/src/components/BrandMark.tsx` + `.brand-wordmark`（`styles.css`）组成；标记颜色走 `--brand-mark-bg` / `--brand-mark-fg`，深色模式自动反色。

## 版权

标记与字标归 RoboEmail 项目所有。Newsreader 依 SIL OFL 使用；照片与校名版权归宁波诺丁汉大学所有。
