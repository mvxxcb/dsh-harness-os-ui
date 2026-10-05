# HARNESS OS · 交接文档

> **给接手者**:这份文档的目的是让你**不必重走我踩过的坑**就能继续。
> 它区分三类信息:**已实测验证的事实**、**已知缺陷**、**架构级限制**。
> 凡是标了「实测」的都附了原始数据,你可以自己复现;凡是没标的,当作待验证。
>
> 请先读第 6 节「红线约束」—— 那是会**弄坏用户界面**的地方。

---

## 1. 项目全貌

### 1.1 两个仓库

| 仓库 | 职责 | 版本 | 规模 |
|---|---|---|---|
| [`mvxxcb/dsh-harness-os-theme`](https://github.com/mvxxcb/dsh-harness-os-theme) | **颜色层**:把 DSH 的 `--dsw-*` 令牌重映射为 HARNESS OS 配色 | v0.1.0 | 15 文件 |
| [`mvxxcb/dsh-harness-os-ui`](https://github.com/mvxxcb/dsh-harness-os-ui) | **结构层**:帧层装饰 + 快捷操作 + HUD + 设计稿预览 + 设置行 | v0.6.1 | 16 文件 |

两者是一套设计语言的两半:**theme 管色,ui 管形**。

### 1.2 本地安装状态

两个插件都以 **`link:`(junction)** 装在 `desktop` profile:

```
C:\Users\mvxxcb\.dsh\profiles\desktop\node_modules\dsh-harness-os-theme
   → junction → E:\dsh\scratch\dsh-harness-os-theme

C:\Users\mvxxcb\.dsh\profiles\desktop\node_modules\dsh-harness-os-ui
   → junction → E:\dsh\scratch\dsh-harness-os-ui
```

**这意味着修改立即影响运行中的应用**:

| 改哪个文件 | 生效方式 |
|---|---|
| `lib/client.js` | 热更新,刷新页面即可 |
| `lib/index.js` | **需要重启 DSH**(host 行在启动时装载) |
| `ui/*` | 刷新预览标签页 |

### 1.3 profile 里其余插件(注意交互)

| 插件 | 版本 | 与我们的关系 |
|---|---|---|
| `dsh-better-sidebar` | 0.24.1 | 占用 `/sidebar/*` 路由;z-index **1000–1003** |
| `dsh-startup-screen` | 1.0.0(已打过补丁) | 占用 `/dsh-startup/*`;启动遮罩 z-index **2147483000** |
| `dsh-whale-widget` | 0.3.18 | **右下角固定挂件** —— 与我们的品牌标记位置冲突(见 4.3) |
| `dsh-theme` | — | **已彻底移除**(用户授权,原 30 套主题包) |

---

## 2. 已验证的进度

### 2.1 UI 插件(结构层)

| 能力 | 挂载点 | 槽位类型 | 状态 |
|---|---|---|---|
| 四角 L 型角标 · 制图辅助线 · 底边线 + 橙点 · 右下品牌标记 | `shell.overlay` | list · **none** | ✅ 已实测 |
| 快捷操作胶囊 + HUD 文本带 + 进度线 | `shell.overlay`(实测定位) | list · none | ✅ 已实测 |
| Hero 雷达环(纯 CSS 圆弧) | `shell.overlay`(实测定位) | list · none | ⚙️ 默认关 |
| 设置行(7 个开关 + 打开设计预览) | `settings.general.item` | list · none | ✅ 已实测 |
| 设计稿预览(封面 + 两屏) | host 路由 `/harness-os/ui` | — | ✅ 已实测 |

**实测证据**(探针写回 localStorage `dsh-harness-os-ui:last`):

```
chromeRect   {x:0, y:0, w:1707, h:1066}      ← 铺满视口
cornerRect   {x:16, y:16, w:16, h:16}        ← 位置正确
cornerPaint  "rgb(152, 145, 138)"            ← = --dsw-alias-label-tertiary，令牌生效
dockRect     {x:630, y:863, w:720, h:63}     ← 底边 926
composerSeatRect {x:280, y:938, w:1421, h:128} ← 顶边 938 → 胶囊整体位于输入座之上
祖先链: .BynINW_overlayLayer {z-index:20, position:absolute, 满屏}
```

**有内容的会话里**(实测 2026-10-05 19:39):`pillsExists:false` / `dockExists:false` / `heroExists:false`
—— 即除帧层外全部隐藏,**不遮挡消息内容**。这是刻意的。

### 2.2 主题包(颜色层)

- 2 套主题:`harness-os-light` / `harness-os-dark`
- **各 103 条令牌**,键名集合完全相同(浅/深同源)
- 通过 `theme.overrideTokens(source, tokens)` 官方层应用
- 自带门禁:`scripts/check-theme-sync.mjs`(字节漂移 + 14 条契约令牌 + 明暗配对)
- 自带行为测试:`tests/smoke-client.mjs`(27 条断言)

### 2.3 已修复的历史缺陷(供你理解代码里的注释)

| 缺陷 | 根因 |
|---|---|
| 主题"改了不起作用" | `documentElement.style.setProperty` 写的令牌**被 DSH 在 `body`/`#root` 上的定义覆盖**。多元素探针证明:`{"html":"", "body":"#141311", "root":"#141311"}` → 改用 `overrideTokens` |
| 快捷操作永远不渲染 | `readPrefs()` 手写 5 个键,后加的 `pills`/`hero` 没补 → `prefs.pills` 恒为 `undefined`。**已改为遍历 `DEFAULTS`**,并加了门禁断言 |
| 雷达环被顶边裁掉 | 定位从 `top` 改 `bottom` 锚定,但 CSS 里 `transform: translate(-50%,-50%)` 没改 → 整块上移半高。**已改 `translateX(-50%)`** |
| 胶囊与 HUD 之间空 366px | 两者拆在**不同锚点**,而 DSH 空白态输入卡位置偏高 → **已合并为一叠** |

---

## 3. 已知缺陷(具体、可修)

### 3.1 诊断代码混在生产产物里 🔴

`lib/client.js`(39 KB / 763 行)里带着三块**只为调试服务**的东西:

| 函数 | 作用 | 问题 |
|---|---|---|
| `probeOverlay()` | 采集几何/计算样式/祖先链 | 每次 apply 后 600ms 写 localStorage |
| `probeLayoutTree()` | 从输入座向上重建布局树 | 同上,数据量大 |
| `startBlankCapture()` | 低频轮询,空白态出现时抓一次 | `setInterval` 最多跑 40 次 × 2s = 80s |
| `recordDiag()` | 写 `dsh-harness-os-ui:last` | 每次写入约 2–8 KB |

**要求**:用构建期常量或 `debug` 偏好开关把它们门控掉,默认不执行。发布版不应有任何 localStorage 写入。

### 3.2 两套独立的轮询定时器 🟡

`Hero` 和 `Dock` **各自**调用 `useAnchors()`,于是**同时存在两个 1200ms `setInterval`**,测量同一个 `[data-composer-seat]`。

**要求**:合并为单一订阅;或改用 `ResizeObserver` / `MutationObserver`,不要轮询。

### 3.3 辅助线位置是拍脑袋的 🟡

`hos-guide` 固定在 `left: 25%` / `75%` —— 这两个位置**不对应任何真实列边界**。设计稿里的辅助线是对齐输入框左右边缘的。

**要求**:对齐 `[data-composer-seat]` 的实测左右边缘(已有 `cx`,再取 `left`/`right` 即可)。

### 3.4 品牌标记与鲸鱼挂件重叠 🔴

`dsh-whale-widget` 固定在右下角,`hos-brand`(`right:16px; bottom:10px`)正好在它下面 —— 用户截图中已被遮挡。

**要求**:改为可配置偏移,或默认放到左下角,或与 `corner` 项合并。

### 3.5 设置行的按钮不像宿主组件 🟡

设置行的 7 个开关是手写的 `<button>` + 内联样式(胶囊 chips),**没有使用 DSH 的设计系统组件**,视觉上与宿主设置项不一致(用户已指出)。

**要求**:改用宿主 `settings.general.item` 的官方控件形态,或至少复用宿主的 toggle/segmented 样式。

### 3.6 `readPrefs` 在 render 期读 localStorage 🟡

`Chrome` / `Dock` / `Hero` 每次渲染都调用 `readPrefs()` → **每帧同步读 localStorage**。

**要求**:提升为模块级缓存 + 订阅更新。

### 3.7 i18n 形同虚设 🟡

`locale.register(SOURCE, 'zh'/'en', …)` 注册了,但 `translate` 在绑定失败时**静默回落到硬编码中文**。没有测试覆盖。

### 3.8 探针无法读回 🔴

`startBlankCapture()` 把布局树写进 localStorage,但**读不回来**:leveldb 压缩合并后明文搜不到,而且 `zstdDecompressSync` 只解第一帧。

**结论**:这条诊断链路目前是**死重**。要么改走 host 路由落盘(见 5.1),要么删掉。详见第 7 节。

---

## 4. 架构级问题(**调参解决不了**)

这一节是核心。前面那些缺陷修完,界面**仍然不会像设计稿**。原因如下。

### 4.1 设计稿是一整页,DSH 空白页是另一整页

| | 设计稿 | DSH 实际空白态 |
|---|---|---|
| 顶部左 | `DEEPSEEK / SYNTHESIZE INTELLIGENCE / HARNESS OS` 三行字标 | 会话标题 + `对话 / 轨迹` 标签页 |
| 顶部右 | `REV 0.1.0 · WEB PROFILE · 18:32:04` | 会话操作按钮 |
| 中央 | **大标题在雷达环正中心** | 小字 `探索未至之境` + `预览版` 徽标,**贴在输入卡上方约 60px** |
| 标题下 | 输入卡 | 工作区行 `dsh ⌄ 标准模式 ⌄` |
| 底部 | HUD 横带 | 宿主状态栏(轮次 / tok) |

**叠浮层能加"图形",加不了"替换文字"。**

### 4.2 宿主标题**没有稳定锚点**(实测) 🔴

如果要把宿主那行小标题换成设计稿的大标题,必须定位它。实测结果(探针 `probeHeroDom`,从最深层含「预览版」的元素向上 7 级):

```
span._text_1rdzk_17            slot=null
  span._3GBCTG_summaryText     slot=null
    span._3GBCTG_summary       slot=null
      span._content_1rdzk_11   slot=null
        span._root_1rdzk_1     slot=null
          div._row_jhda5_16    slot=null
            div._root_jhda5_9  slot=null
```

**整条链 `data-slot` 全为 `null`,全是 CSS Module 编译哈希**(`1rdzk`、`3GBCTG` 是构建生成的)。

**含义**:任何基于这些选择器的适配,**每次 DSH 构建都会失效**,而且是**静默失效**(没有报错,只是样式不再命中)。

### 4.3 槽位拓扑的关键结论(已逐个查证)

| 槽位 | 类型 | 能否用 | 原因 |
|---|---|---|---|
| `shell.overlay` | list, replaceRisk **none** | ✅ **首选** | 官方文档原文:"Frame-wide floating layer… **The layer itself is click-through** … the **additive** seat for a frame-wide surface of your own" |
| `settings.general.item` | list, none | ✅ | 已占用 `order 22`(主题行是 21) |
| `conversation.composer.dock` | list, none | ❌ **陷阱** | 见 4.4 |
| `conversation.hero.workspace` | **single**, `shadows-shipped-ui` | ⚠️ | 定义是 *"Workspace picker shown by the blank-session Hero"* —— 占它只会**顶掉工作区选择器**,拿不到 Hero 视觉 |
| `conversation.composer.bar` | single, `shadows-shipped-ui` | ❌ | 占它 = 顶掉整个输入区 |
| `main.conversation` | **single**, `shadows-shipped-ui` | ❌ | 占它 = 顶掉整个会话外壳 |
| `conversation.content` | **工厂,不是槽位** | ❌ | 其下无加性子槽(两处独立验证) |

**宿主没有暴露"Hero 视觉容器"或"空白态标题"的任何槽位。**

### 4.4 `conversation.composer.dock` 是陷阱(实测) 🔴

它的官方定义听起来完美:*"Ambient entries **below the composer card**"*,且 `replaceRisk: none`。

**但实测数据**:

```
dockRect          {x:867, y:983, w:540, h:79}     ← 我挂进去的东西
composerSeatRect  {x:280, y:881, w:1421, h:185}   ← 视口高 1066
```

输入座从 881 **一直顶到 1066 = 视口底部**。挂进去的内容被夹在输入卡与宿主状态行之间一条**没有余量的缝**里 —— **元素存在、尺寸正常、就是看不见**。

**DSH 的布局没有给"输入卡下方"预留任何空间。**

### 4.5 设计稿要求 HUD/胶囊**常驻**,DSH 没这个空间

有内容的会话里,输入卡下方同样被消息内容占满。因此当前实现只能:

- **空白会话**:显示胶囊 + HUD + 雷达环
- **有内容的会话**:只显示帧层,其余全隐藏

这是**对设计意图的偏离**,原本设计里 HUD 是常驻的工作区框架。要常驻就必须盖住消息 —— 这是个产品取舍,不是技术问题。

---

## 5. 开放决策(需要产品判断,不要自行拍板)

### 5.1 用户已选择「方案 B:接管宿主空白页」

用户在三条路里选了 B:**用结构选择器接管宿主空白页**(隐藏宿主小标题、换上大标题、加顶部字标与元信息)。

**用户明确接受脆弱性**(DSH 升级后可能静默失效)。

**当前卡在哪**:需要空白态的真实 DOM 结构,而:
- localStorage 诊断读不回来(见 3.8)
- 文本匹配不可靠(见 8.2)

**已达成一致的工程约束**(实现 B 时必须遵守):
1. **失败即无操作** —— 找不到预期结构就什么都不做,绝不留半截样式
2. **一个总开关** —— 设置里加「接管空白页」,一键回到纯加性模式
3. **只在空白会话生效** —— 有内容的会话完全不碰
4. **哈希/结构选择器集中一处并标注构建指纹** —— 便于将来定位过期项

**建议的破局路径**:在 host 半开一个**只写诊断文件**的路由(渲染端 POST → 落盘),这样采样稳定可比对,不再依赖 localStorage。

### 5.2 待用户确认的两处冲突(已记录在 `docs/BRIEF.md`)

1. **品牌写法**:需求文本写 `HARNESSS`(三 S),参考图与启动动画是 `HARNESS`(两 S)。
   当前实现统一用**两 S**。改动涉及两处(主题包的 `brand__badge`、UI 的启动序列第 6 项)。
2. **卡片布局冲突**:参考图标注第 5 条说"卡片式布局",而正文说"不要大面积卡片"。
   当前实现用**模块化分区**替代卡片堆叠。

### 5.3 两个仓库职责有重叠

theme 管色、ui 管形,但**没有共享的令牌来源** —— 设计稿的 `styles/tokens.css` 是独立一套,与主题包的 103 条令牌**不互通**。

**风险**:改一边忘另一边。**建议**:让 UI 的预览页直接消费主题包的令牌,或在两仓库间建立同步校验。

---

## 6. 红线约束(违反会弄坏用户界面)

### 6.1 CSS 必须作用域化 🔴🔴

DSH 的界面在同一个页面里。**一条裸选择器就会毁掉整个应用**。

**每条 CSS 规则必须以 `#harness-os-chrome` / `#harness-os-dock` / `#harness-os-hero` 开头。**

门禁 `scripts/check.mjs` **逐条断言**这一点。不要为了图快把 `SCOPES` 白名单放宽。

### 6.2 只消费令牌,绝不覆盖令牌 🔴

UI 插件里**不得出现**:

```
documentElement.style
body.style
.overrideTokens(
theme.register(
```

令牌覆盖是**主题包的职责**。两层覆盖会互相打架,后注册者赢。

### 6.3 不得声明 `@deepseek-ai/dsh-*` peerDependency 🔴

DSH 把 peer 当**启动期硬约束**:范围不满足 → `row.disabled = true`,**只在 stderr 留一行**。表现为"装上了但完全没反应",极难排查。

### 6.4 z-index 必须低于两个上界 🔴

| 上界 | 值 |
|---|---|
| 启动遮罩 `dsh-startup-screen` | **2147483000** |
| `dsh-better-sidebar` 弹层 | **1000–1003** |

当前实现用 `z-index: 0`,靠 `shell.overlay` 自身的层级(实测祖先 `.BynINW_overlayLayer {z-index:20}`)浮起。**不要往上加。**

### 6.5 不要挂回 `conversation.composer.dock`

门禁里有**反向断言**专门拦这个(见 4.4)。

### 6.6 设置行 id 不能重名

UI 插件用 `id: 'dsh-harness-os-ui'`(order 22);主题包用 `'dsh-harness-os-theme'`(order 21)。**复用 id 会顶掉对方那一格。**

---

## 7. 环境陷阱(本机特有,不知道会浪费大量时间)

| 陷阱 | 表现 | 应对 |
|---|---|---|
| **`git` 无法访问 GitHub** 🔴 | 所有 HTTPS 握手失败:`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e)`。`curl` / `Invoke-WebRequest` 同样 | 用 `gh`(Go TLS)走 **Git Data API** 推送。现成脚本:`E:\dsh\scratch\push-dsh-harness-os-ui.ps1`(已支持 `-Message`) |
| **`app.asar\dsh\` 是虚拟路径** | 文件系统层面不存在,rg/grep 全部 `os error 3` | asar 是打包档,**按字节解析**:0..3=4,4..7=header pickle 大小,8..11/12..15=JSON 大小,16..=JSON,数据区起点 `8+headerSize`。现成脚本:`E:\dsh\scratch\plugin-audit\asar-extract.py` |
| **无头 Chrome 需要提权** | `FATAL:mojo platform_channel.cc:112 Check failed: 拒绝访问 (0x5)` | 该命令需 `sandbox_permissions: danger-full-access`。脚本:`harness-os-ui/scripts/shoot.ps1` |
| **会话日志是多帧 zstd** 🔴 | `zlib.zstdDecompressSync` **只解第一帧** —— 3.5MB 的档只解出 1 条记录 | 按魔数 `28 b5 2f fd` 切帧逐帧解。现成脚本:`E:\dsh\scratch\plugin-audit\count-compactions.mjs` |
| **Python 没有 zstd 模块** | `zstandard` / `zstd` / `pyzstd` 全部 ModuleNotFoundError | 用 **Node** —— `zlib.createZstdDecompress()` / `zstdDecompressSync` 内置 |
| **leveldb 读不出诊断** 🔴 | localStorage 压缩合并后明文搜不到;`.ldb` 块 snappy 压缩 | 不要依赖 localStorage 做跨进程读取 |
| **PowerShell 原生参数会吃掉 jq 引号** | `gh api --jq "..."` 里的 `"` / `\(` 被 PowerShell 改写 | 用 `ConvertFrom-Json` 解析,不要用 `--jq` 传复杂表达式 |
| **`$args` / `$home` 是自动变量** | 赋值报错或行为诡异 | 换名(`$cmdArgs`) |

---

## 8. 我自己踩过的三个坑(请务必不要重走)

### 8.1 把「元素存在」当成「功能生效」—— 犯了两次 🔴

- 第一次:探针只查 `mounted` / 子节点计数 → 报了"已生效",**用户截图上什么都没有**。真实原因是 1px 线 + `border-l1`(深色下 `#ffffff12` = **7% 白**),截图缩放后彻底消失。
- 第二次:槽位注册成功就以为组件在渲染 → 漏了 `readPrefs` 漏键导致组件返回 `null`。

**正确做法**:探针必须证明**可见性** —— 取 `getBoundingClientRect()` + `getComputedStyle`(position/z-index/opacity/display/visibility)+ **逐级祖先的 rect 与 overflow/transform/contain**(找出谁在裁剪或改变包含块)。

**并且**:用户截图是视觉结果的**唯一真相来源**。几何数据正确 ≠ 用户看得见。

### 8.2 用文本匹配定位 DOM —— 匹配到了我自己发的消息 🟡

按「预览版」三字找标题,结果命中了**我上一条回复里引用的这三个字** —— 聊天正文也在 DOM 里。

**正确做法**:从**稳定锚点**出发向上重建结构(`[data-composer-seat]` 是唯一在两种状态下都存在的锚点),不要按文本搜。并且要排除 `[data-slot="conversation.chat.node"]` 与 `[data-conversation-region="composer"]` 子树。

### 8.3 手写键列表会随定义漂移 🟡

`readPrefs()` 手写 5 个键,后来 `DEFAULTS` 加到 7 个 → 漏键 → **静默失效**(快捷操作永不渲染、Hero 永远打不开)。

**正确做法**:遍历 `DEFAULTS` 生成,并让门禁断言「DEFAULTS 键集 = readPrefs 初始化 = 设置行开关列表」三者一致。**已实现**。

---

## 9. 验证协议(改完必须走)

```powershell
cd E:\dsh\scratch\dsh-harness-os-ui
$node = "C:\Users\mvxxcb\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"

# 1) 语法
Copy-Item lib/client.js _c.mjs -Force; & $node --check _c.mjs; Remove-Item _c.mjs -Force

# 2) 门禁（清单 / 白名单 / CSS 作用域 / 令牌纪律 / 偏好键一致 / 跨插件占用）
& $node scripts/check.mjs
```

期望输出:

```
· UI_FILES：6 条，磁盘 6 个文件，一一对应
· 与 4 个已装插件比对：路由 / 标识 无重叠
· CSS 作用域：61 条规则全部限定在 3 个作用域根内
· 偏好键一致：DEFAULTS、readPrefs、设置行开关同为 7 个键
✓ 全部通过（4 组检查）
```

**主题包另有自己的门禁**:

```powershell
cd E:\dsh\scratch\dsh-harness-os-theme
& $node scripts/check-theme-sync.mjs    # 字节漂移 + 14 条契约令牌 + 明暗配对
& $node tests/smoke-client.mjs          # 27 条行为断言
```

**视觉验证**:改完让用户刷新页面截图。不要仅凭几何数据宣称修好。

---

## 10. 关键数据速查

### 10.1 当前生效的深色令牌(实测自 `body` 内联样式)

```
--dsw-alias-bg-base         #141311
--dsw-alias-bg-layer-1      #1c1a17
--dsw-alias-bg-layer-2      #242220
--dsw-alias-border-l1       #ffffff12   ← 7%，几乎不可见
--dsw-alias-border-l2       #ffffff1f
--dsw-alias-border-l3       #ffffff2b
--dsw-alias-border-l4       #ffffff38   ← 22%
--dsw-alias-brand-primary   #ff8a2b
--dsw-alias-label-primary   #f2efe9
--dsw-alias-label-secondary #c3bcb2
--dsw-alias-label-tertiary  #98918a
--dsw-alias-label-caption   #8a837c
--dsw-alias-label-dimmed    #6f6963
```

> **令牌不在 `<html>` 上,在 `body` / `#root`。** 写 `documentElement.style.setProperty` 会被覆盖。

### 10.2 稳定 DOM 锚点(可安全依赖)

```
[data-composer-seat]                         输入座（两种状态都存在）
[data-conversation-region="composer"]        输入区
[data-slot="conversation.chat.node"]         消息节点
[data-slot="conversation.session"]           会话区
[data-slot="…"]                              任意槽位都渲染为 data-slot="<slotKey>"
[data-platform="win32|darwin"]               平台
[data-sidebar-collapsed] / [data-rightbar-collapsed]   框架状态
```

### 10.3 当前上下文/压缩参数(用户会追问)

- 模型:`deepseek-official / deepseek-flash`,**contextWindow = 1,000,000**
- 触发阈值 = `floor(min(contextWindow × 0.8, (窗口 − 预留输出) − 65536))` → **800,000**
- 压缩后保留 = `floor(messageBudget × 0.16)` ≈ **160,000**
- 实测:本次对话在 **678,492** 触发(低于阈值 → 走的是 `context-overflow` 分支),压缩后 **158,994**(与 0.16 预测吻合)

---

## 11. 建议的下一步(按优先级)

1. **门控诊断代码**(3.1)—— 发布版不应写 localStorage
2. **修正品牌标记位置冲突**(3.4,与鲸鱼挂件)
3. **辅助线对齐输入座实测边缘**(3.3)
4. **设置行改用宿主控件形态**(3.5)
5. **合并两套轮询定时器**(3.2)
6. **实现方案 B**(5.1)—— 先解决采样:host 路由落盘
7. **决定 HUD 是否常驻**(4.5)—— 需要用户拍板

---

## 12. 相关文件索引

```
E:\dsh\scratch\
├─ dsh-harness-os-theme\          主题包（link 安装）
│   ├─ themes\harness-os.json     2 主题 × 103 令牌
│   ├─ src\client.template.js     源码（唯一事实来源）
│   ├─ lib\client.js              生成产物（勿手改）
│   └─ scripts\check-theme-sync.mjs
├─ dsh-harness-os-ui\             UI 插件（link 安装）
│   ├─ lib\client.js              763 行：CSS + 组件 + 探针
│   ├─ lib\index.js               host 白名单路由
│   ├─ ui\                        设计稿（封面 + 两屏）
│   ├─ scripts\check.mjs          门禁
│   └─ docs\BRIEF.md              用户的设计需求（251 行）
├─ push-dsh-harness-os-ui.ps1     推送脚本（gh + Git Data API，支持 -Message）
└─ plugin-audit\
    ├─ asar-extract.py            asar 按需取文件
    ├─ count-compactions.mjs      会话压缩统计（多帧 zstd）
    ├─ conflict-scan.py           跨插件资源占用扫描
    └─ dom-anchors.py             从 asar 提取 data-* 锚点
```
