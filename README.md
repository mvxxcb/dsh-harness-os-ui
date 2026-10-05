# dsh-harness-os-ui

**HARNESS OS 的帧层界面插件 —— 四角定位角标 · 制图辅助线 · 底边线 HUD,外加一套完整设计稿预览。**

延续 HARNESS OS 启动动画的视觉语言,把它的"仪器面板"框架落到真实客户端上。

---

## 它做什么

| 能力 | 挂载点 | 槽位类型 |
|---|---|---|
| **帧层装饰**：四角 L 型角标、制图辅助线、底边线 + 橙色活动节点、右下品牌标记 | `shell.overlay` | list · none |
| **快捷操作胶囊**：文件上传 / 知识库 / 生成图像 | `conversation.composer.dock` | list · none |
| **底部 HUD 文本带**：信号柱、`[ 01 / 06 ] HOME`、`等待用户输入…`、`REV 0.1.0`、进度条 | `conversation.composer.dock` | list · none |
| **设置行**：六个开关 + 打开设计预览 | `settings.general.item` | list · none |
| **设计稿预览**：完整 HOME / SETTINGS 两屏 | host 路由 `/harness-os/ui` | — |
| **随主题变色** | 颜色一律消费 `var(--dsw-alias-*)` | — |

挂载点全部是 `replaceRisk: none` 的**加性席位** —— 新 id 加在自带条目旁边,绝不顶替。

## 为什么 Hero 还没做(以及它在哪)

设计稿中央的雷达环 + 「探索未至之境」需要一块**空白会话的 Hero 区域**。查过槽位目录后:

- `conversation.hero.workspace` 的官方定义是 *"Workspace picker shown by the blank-session Hero"*,
  它是 **single** 且 `replaceRisk: shadows-shipped-ui` —— 占它会**顶掉宿主的 Workspace 选择器**。
- `conversation.hero.workspace.directoryFlow` 同理。
- 宿主**没有暴露**"Hero 视觉容器"的槽位。

所以 Hero 只能走两条路:①`shell.overlay` 在空白会话时叠一层(会与宿主自己的 Hero 文案视觉重叠);
②替换 `conversation.hero.workspace`(失去 Workspace 选择器)。
两条都需要你确认取舍,因此**默认关闭**,留了 `hero` 开关位。

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
docs/DESIGN.md      设计系统说明：取色、字阶、间距、组件语言、取舍
```

## License

MIT
