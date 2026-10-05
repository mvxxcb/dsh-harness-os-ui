# dsh-harness-os-ui

**HARNESS OS 的帧层界面插件 —— 四角定位角标 · 制图辅助线 · 底边线 HUD,外加一套完整设计稿预览。**

延续 HARNESS OS 启动动画的视觉语言,把它的"仪器面板"框架落到真实客户端上。

---

## 它做什么

| 能力 | 挂载点 | 槽位类型 |
|---|---|---|
| **帧层装饰**：四角 L 型角标、制图辅助线、底边线 + 橙色活动节点、右下品牌标记 | `shell.overlay` | list · none |
| **快捷操作胶囊**：文件上传 / 知识库 / 生成图像 | `shell.overlay`（实测定位） | list · none |
| **HUD 文本带**：信号柱、`[ 01 / 06 ] HOME`、`等待用户输入…`、`REV 0.1.0`、进度条 | `shell.overlay`（实测定位） | list · none |
| **Hero 雷达环**：中央错位圆弧 + 「探索未至之境」，仅空白会话 | `shell.overlay`（实测定位） | list · none |
| **设置行**：七个开关 + 打开设计预览 | `settings.general.item` | list · none |
| **设计稿预览**：完整 HOME / SETTINGS 两屏 | host 路由 `/harness-os/ui` | — |
| **随主题变色** | 颜色一律消费 `var(--dsw-alias-*)` | — |

挂载点全部是 `replaceRisk: none` 的**加性席位** —— 新 id 加在自带条目旁边,绝不顶替。

## 两个由实测数据纠正的决定

这两个决定都不是猜的,是探针读回真实几何数据后改的。**"元素存在"不等于"看得见"** ——
第一版探针只查 `mounted` 与子节点计数,于是下面两种"看不见"都被误报成已生效。

**① 快捷操作与 HUD 从 `conversation.composer.dock` 移到浮层。**
该席位的官方定义确实是 *"Ambient entries below the composer card"*,但实测:

```
dockRect          {x:867, y:983, w:540, h:79}
composerSeatRect  {x:280, y:881, w:1421, h:185}   // 视口高 1066
```

输入座一直顶到视口底部,**没有给"下方 HUD"预留任何空间**。内容被塞进输入卡与宿主
状态行之间一条没有余量的缝里:元素存在、尺寸正常,视觉上却完全看不到。
改由浮层承载并用实测的输入座位置定位后:

```
dockRect          {x:630, y:863, w:720, h:63}     // 底边 926
composerSeatRect  {x:280, y:938, w:1421, h:128}   // 顶边 938 → 整体位于座顶之上
```

**② 帧层线色从 6%/22% 白提到 `label-tertiary`。**
实测 `chromeRect {0,0,1707,1066}`、`zIndex 0`、`visibility visible`、祖先
`.BynINW_overlayLayer {z-index:20}` —— 几何与层级全部正确,仍然看不见,
原因是 1px 线 + `border-l1`(6% 白)在深色底上再经一次截图缩放就消失了。
**"克制"不等于"不可见"**,HUD 框线本来就需要能读出来。

## Hero 雷达环（叠加式，默认关闭）

设计稿中央的雷达环 + 「探索未至之境」需要一块**空白会话的 Hero 区域**。查过槽位目录后:

- `conversation.hero.workspace` 的官方定义是 *"Workspace picker shown by the blank-session Hero"*,
  它是 **single** 且 `replaceRisk: shadows-shipped-ui` —— 占它只会**顶掉宿主的 Workspace 选择器**,
  拿不到 Hero 的背景视觉。
- `conversation.content` 是**工厂**不是槽位,其下没有加性子槽(两处独立验证过)。

所以 Hero 走**叠加层**实现,并且刻意为:

1. **位置实测,不猜中心** —— 读 `[data-composer-seat]`(文档化的稳定锚点)的包围盒,
   把雷达环居中在输入座正上方。按视口 50% 居中会因为左侧栏而整体偏左。
2. **空会话判定保守** —— 只要任一 `[data-slot="conversation.chat.node"]` 带非空文本就隐藏;
   任何不确定也隐藏。宁可少显示,也绝不盖在真实对话上。
3. **默认关闭** —— 因为宿主自己的欢迎文案也在同一区域,可能视觉重叠。
   开关在「设置 → 通用 → HARNESS OS 界面 → Hero 雷达环」,开了自己看效果再决定去留。

雷达环用**纯 CSS 圆弧**(圆 + 透明边框 + 只给部分边着色)实现,而不是内联 SVG data-URI ——
因为 data-URI 里解析不了 CSS 变量,颜色就只能硬编码;纯 CSS 方案让颜色全部走 `--dsw-*` 令牌。

## 为什么是"加性叠加"而不是"替换界面"

挂载点选择不是风格问题,是安全问题。查过宿主槽位拓扑后:

- `main.conversation` 是 **single** 槽且标注 `replaceRisk: "shadows-shipped-ui"` ——
  替换它会顶掉宿主自己的会话外壳(消息流、输入区、工具渲染全在里面)。
- 宿主**没有暴露"欢迎态/空态"槽位**,所以设计稿里的居中 Hero 无法"正规地"插进去;
  硬盖会与宿主自己的欢迎页叠在一起。
- `shell.overlay` 是官方文档明确指定的**加性席位**:

  > *"Frame-wide floating layer... **The layer itself is click-through** — entries opt back
  > into pointer events — so an occupant never blocks the app underneath. This is the
  > additive seat for a frame-wide surface of your own: a fresh `id` is added beside the
  > shipped entries instead of replacing them."*

**结论**:装饰走 `shell.overlay`(加性、点击穿透、可随时关掉);完整设计通过预览页呈现。
这样插件**在结构上不可能挡住或顶掉宿主界面**。

## 三条防污染硬约束

设计稿本身是"整页级"的(全局 reset、`body` 背景、100vh 栅格)。直接注入会把应用布局毁掉。
所以插件版的实现遵守三条,并且**由 `npm run check` 逐条断言**(不是靠自觉):

1. **样式零全局污染**
   没有 `*` reset、不碰 `body`、不写 `:root`;CSS 数组里
   **每一条规则都必须以 `#harness-os-chrome` 开头** —— 校验器会逐条检查,出现裸选择器即失败。

2. **只消费令牌,绝不覆盖令牌**
   颜色只走 `var(--dsw-alias-*)`。客户端**不得**出现 `documentElement.style` /
   `body.style` / `theme.overrideTokens(` / `theme.register(` ——
   校验器剥掉注释后扫描,命中即失败。
   (令牌覆盖是主题插件的职责;两层覆盖会互相打架,后注册者赢。)

3. **不声明 `@deepseek-ai/dsh-*` peer**
   DSH 把 peer 当启动期硬约束,范围不满足会 `row.disabled = true` 且只在 stderr 留一行,
   表现为"装上了但完全没反应"。本插件只读稳定公开服务,无版本耦合。

## 冲突审查(已自动化)

`scripts/check.mjs` 在提交前跑六组检查,其中跨插件比对会读取 profile 里已安装的插件,
逐项比对**路由前缀 / 全局标识 / 槽位 id**:

```
· UI_FILES：6 条，磁盘 6 个文件，一一对应
· 与 5 个已装插件比对：路由 / 标识 无重叠
· CSS 作用域：31 条规则全部限定在 #harness-os-chrome 内
✓ 全部通过
```

实测的占用矩阵(本插件全部避开):

| 插件 | 路由 | 全局 | localStorage | DOM id | z-index |
|---|---|---|---|---|---|
| dsh-better-sidebar | `/sidebar/*` | `__dshChunks__` | 前缀键 | — | 1000–1003 |
| dsh-startup-screen | `/dsh-startup/*` | `__DSH_STARTUP*` | `dsh-startup-screen:*` | `dsh-startup-root` | 2147483000 |
| dsh-harness-os-theme | — | — | `dsh-harness-os-theme:*` | `…-decor` | — |
| **dsh-harness-os-ui** | **`/harness-os/ui`** | `__ModuleLoader__` | `dsh-harness-os-ui:*` | `harness-os-chrome` | **0** |

装饰层 `order` 取负值、`z-index: 0`,排在自带 toast 之下 —— 装饰本来就该在最底下,
也不能压过启动动画(2147483000)。

## 安装

```sh
dsh plugin --profile <你的profile> add github:mvxxcb/dsh-harness-os-ui
```

装完**重启 DSH**(新增了 host 行),再刷新页面。

卸载:

```sh
dsh plugin --profile <你的profile> remove dsh-harness-os-ui
```

## 使用

**设置 → 通用 → HARNESS OS 界面**:

| 控件 | 默认 | 说明 |
|---|---|---|
| 四角定位角标 | 开 | 屏幕四角的 L 型细线角标 |
| 制图辅助线 | 开 | 25% / 75% 两条极细竖线 |
| 底边线 | 开 | 视口底部 2px 边线 + 橙色活动节点 |
| 品牌标记 | 开 | 右下角 `HARNESS OS` 微标 |
| HUD 文本带 | **关** | 底部完整 HUD 文字;会与底部内容视觉重叠,按需开启 |
| 打开设计预览 | — | 新标签打开完整设计稿(建议配 `dsh-harness-os-theme` 一起看) |

## 设计稿预览

host 半按**严格白名单**提供 `ui/` 下的 6 个文件:

```
/harness-os/ui/                     → 封面（设计系统摘要）
/harness-os/ui/home.html            → 01 HOME / 工作台
/harness-os/ui/settings.html        → 02 SETTINGS / 设置
/harness-os/ui/styles/*.css         → 设计令牌与组件层
```

白名单的意义:路径集合在构建期完全已知,所以请求路径**不参与文件系统寻址** ——
目录穿越在结构上不可能发生,而不是靠事后过滤 `..`。每个路由都先过
`ctx.connection.requestRejection(req)`,与宿主 `/api` 网关同一套浏览器信任栅栏。

## 项目结构

```
lib/index.js        host 半：白名单静态路由 + 信任栅栏
lib/client.js       client 半：shell.overlay 装饰 + 设置行
ui/                 设计稿（封面 + 两屏 + 设计系统 CSS）
scripts/check.mjs   提交前门禁（清单 / 白名单 / 作用域 / 令牌纪律 / 跨插件占用）
docs/BRIEF.md       设计需求：视觉语言、禁用项、两屏逐项规格、待确认项
docs/DESIGN.md      设计系统说明：取色、字阶、间距、组件语言、取舍
```

## License

MIT
