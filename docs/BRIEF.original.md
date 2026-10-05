# 设计需求原文(逐字)

> **来源**:用户于 2026-10-05 19:06 提交的需求提示词,随附 1 张标注参考图。
>
> **本文是逐字原文,未做任何修改。** 它是从 DSH 会话日志
> (`~/.dsh/sessions/--E-dsh--/session-19472a66-*/session.v4.jsonl.zstd`)中按 `seq=1791`
> 精确取回的 —— 此前曾误判为"随上下文压缩丢失",实际可完整恢复。
>
> **配套文件**:
> - [`BRIEF.md`](BRIEF.md) —— 同一需求的结构化版本(可执行规格,含待确认项)
> - [`reference/annotated-home-settings.png`](reference/annotated-home-settings.png) —— 随附的标注参考图

---

以下为ui设计提示词，以提供的前三张 DeepSeek HARNESSS OS 启动动画作为唯一视觉参考，
继续设计其进入系统后的桌面端 UI。

需要设计两张独立界面：

01 — HOME / 工作台
02 — SETTINGS / 设置

两张界面必须属于同一套 UI Design System，
严格延续参考图中的视觉语言，不要重新创造另一种风格。

━━━━━━━━━━━━━━━━━━━━
VISUAL SYSTEM
━━━━━━━━━━━━━━━━━━━━

整体风格：

极简未来主义
工业控制台
Swiss International Typographic Style
精密 HUD Interface
Editorial UI
High-end AI Operating System

视觉基调：

暖白 / 米白背景
黑色主文字
浅灰辅助文字
极少量 Deep Orange 作为 Accent Color

整体低饱和、低对比、克制。

大量留白。

细边框。

细分割线。

精确网格。

不使用大面积装饰。

不使用渐变。

不使用玻璃拟态。

不使用霓虹。

不使用传统 Cyberpunk。

不使用游戏 HUD。

━━━━━━━━━━━━━━━━━━━━
LAYOUT
━━━━━━━━━━━━━━━━━━━━

桌面端 16:9。

整体采用固定左侧 Sidebar + 主内容区域。

左侧 Sidebar 宽度约 240–260px。

主内容区域占据剩余空间。

所有内容严格按照统一 Grid 对齐。

页面四周保留明显留白。

使用极细的垂直辅助线和水平辅助线，
形成类似建筑制图 / 工业控制台的空间结构。

屏幕四角加入非常细的 L 型定位角标。

━━━━━━━━━━━━━━━━━━━━
01 HOME / WORKSPACE
━━━━━━━━━━━━━━━━━━━━

左侧 Sidebar：

顶部：

DeepSeek Logo
HARNESSS

下面：

新会话
NEW SESSION

插件
PLUGINS

分割区域：

工作区
WORKSPACE

右侧提供：

搜索
筛选
新建

工作区列表：

我的工作区
默认工作区

底部保留账号入口。

Sidebar 不要做成普通网页导航。

采用极简文字 + 小型线性 Icon。

当前选中项目：

左侧一根短橙色竖线
或者极细橙色底线。

━━━━━━━━━━━━━━━━━━━━
HOME HEADER
━━━━━━━━━━━━━━━━━━━━

主区域顶部加入系统信息：

REV 0.1.0
WEB PROFILE
18:32:04

右侧使用橙色时间。

旁边加入细小灰色刻度线。

整体参考启动动画顶部的系统信息排版。

━━━━━━━━━━━━━━━━━━━━
CENTER HERO
━━━━━━━━━━━━━━━━━━━━

首页中央保留启动动画中的核心视觉语言：

同心圆
开放圆环
扫描弧线
细线
定位节点
橙色状态点

不要做完整的圆。

多个不同半径的圆弧互相错位。

部分圆弧使用黑色。

部分使用浅灰。

部分使用非常细的白线。

少量橙色圆点作为动态状态节点。

形成一个抽象的 AI Core / Scanner。

中央标题：

探索未知之境

英文：

EXPLORE THE UNKNOWN

中文为主标题。

英文作为小号 Tracking Typography。

标题必须居中。

标题周围保持大量留白。

━━━━━━━━━━━━━━━━━━━━
CHAT INPUT
━━━━━━━━━━━━━━━━━━━━

Hero 下方设置主要输入区域。

输入框宽度约 650–750px。

高度约 100–120px。

白色 / 暖白色表面。

1px 浅灰边框。

极轻微阴影。

轻微圆角，但不要过度圆润。

顶部：

描述你想要构建的内容，例如……

底部工具栏：

＋
工作区内搜索
模型选择

右侧：

DeepSeek V4.1-Flash

最右侧：

橙色圆形发送按钮。

输入区域整体保持极简。

不要加入多余功能。

━━━━━━━━━━━━━━━━━━━━
QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━

输入框下方设置少量快捷操作：

文件上传
知识库
生成图像

使用小型胶囊按钮。

白色背景。

1px 灰色边框。

小图标。

小号文字。

选中状态使用橙色。

三个按钮保持水平排列。

━━━━━━━━━━━━━━━━━━━━
BOTTOM HUD
━━━━━━━━━━━━━━━━━━━━

底部延续启动动画 HUD。

左下：

橙色信号柱

[ 01 / 06 ] HOME

中央：

等待用户输入...
AWAITING USER INPUT

最底部：

细长进度条。

黑色进度线。

一个橙色活动节点。

右下：

POWERED BY DEEPSEEK

所有文字使用极小字号。

Monospace / Condensed Typography。

━━━━━━━━━━━━━━━━━━━━
02 SETTINGS
━━━━━━━━━━━━━━━━━━━━

第二张独立页面：

SETTINGS

整体结构与 HOME 完全一致。

左侧保持同样的 Sidebar。

右侧进入设置内容区域。

━━━━━━━━━━━━━━━━━━━━
SETTINGS SIDEBAR
━━━━━━━━━━━━━━━━━━━━

设置项目：

账号与余额
通用设置
模型
内置插件
Agent 预设
启动动画
侧边卡片

每个项目：

线性 Icon
中文名称
小号英文辅助文字

当前选中项目：

橙色左边线。

━━━━━━━━━━━━━━━━━━━━
SETTINGS HEADER
━━━━━━━━━━━━━━━━━━━━

顶部：

设置

SETTINGS

右上：

打开配置文件

关闭按钮

整体保持极简。

━━━━━━━━━━━━━━━━━━━━
SETTINGS CONTENT
━━━━━━━━━━━━━━━━━━━━

采用纵向模块化布局。

每个设置模块：

模块标题
英文辅助标题
细分割线
参数内容

不要使用传统大面积 Card。

使用：

细线
留白
文字层级
小型控件

建立层次。

━━━━━━━━━━━━━━━━━━━━
GENERAL SETTINGS
━━━━━━━━━━━━━━━━━━━━

界面设置：

主题
LIGHT / DARK / SYSTEM

语言
中文 / ENGLISH

动画
ON / OFF

启动动画
ON / OFF

HUD 效果
ON / OFF

工作区设置：

默认工作区

自动保存

历史记录

使用精密的小型 Toggle / Segmented Control。

控件尺寸克制。

━━━━━━━━━━━━━━━━━━━━
MODEL
━━━━━━━━━━━━━━━━━━━━

模型设置页面：

MODEL

当前模型：

DeepSeek V4.1-Flash

显示：

模型名称
状态
上下文
速度
推理能力

使用极细的横向参数条。

不要做传统数据 Dashboard。

━━━━━━━━━━━━━━━━━━━━
PLUGINS
━━━━━━━━━━━━━━━━━━━━

插件页面使用纵向列表。

每一项：

Plugin Name
简短说明
Status
Toggle

列表之间使用细线分隔。

激活状态：

橙色状态点。

━━━━━━━━━━━━━━━━━━━━
AGENT PRESETS
━━━━━━━━━━━━━━━━━━━━

使用简洁的 Agent 列表：

Research
Design
Coding
Writing
Custom

每个项目采用横向列表。

左侧编号：

01
02
03
04
05

中间：

名称

右侧：

ACTIVE / INACTIVE

选中状态使用橙色线条。

━━━━━━━━━━━━━━━━━━━━
BOOT SEQUENCE
━━━━━━━━━━━━━━━━━━━━

设置中加入启动动画管理。

展示六个启动阶段：

01
ACCESS PERMISSION

02
IDENTITY VERIFICATION

03
SYSTEM INITIALIZATION

04
SYSTEM CHECK

05
VERIFICATION

06
HARNESSS OS

采用横向或者纵向 Timeline。

使用：

细灰线
黑色节点
橙色当前节点

严格对应参考图前三张启动画面的设计语言。

━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY
━━━━━━━━━━━━━━━━━━━━

中文使用现代无衬线字体。

类似：

Noto Sans SC
PingFang
Helvetica Neue

英文系统信息使用：

IBM Plex Mono
DIN
Inter
Monospace

标题：

粗体、低字重变化、较大字号。

系统信息：

小字号 + 高字距。

英文辅助文字：

ALL CAPS
WIDE LETTER SPACING

中文和英文之间保持明显层级差。

━━━━━━━━━━━━━━━━━━━━
UI COMPONENTS
━━━━━━━━━━━━━━━━━━━━

统一组件语言：

1px borders
small radius
thin dividers
linear icons
compact buttons
small labels
monospace metadata
orange active state

按钮不要过大。

卡片不要过圆。

Icon 不要复杂。

所有组件严格遵循 8px / 4px spacing system。

━━━━━━━━━━━━━━━━━━━━
DETAILS
━━━━━━━━━━━━━━━━━━━━

增加少量系统微细节：

REV 0.1.0
SYSTEM READY
CORE ONLINE
SESSION ACTIVE
WORKSPACE
STATUS
ACTIVE
READY

这些只作为视觉辅助信息。

字号非常小。

颜色浅灰。

不要让这些信息抢主体。

加入：

细刻度
短横线
坐标
编号
状态点
微型进度条

但必须克制。

━━━━━━━━━━━━━━━━━━━━
MATERIAL
━━━━━━━━━━━━━━━━━━━━

背景具有极轻微纸张 / 数字噪点质感。

非常细微。

几乎不可察觉。

不要明显纹理。

不要金属材质。

不要玻璃材质。

不要 3D。

不要强烈阴影。

整体像：

高端工业产品设计稿
+ Swiss Editorial Design
+ AI Operating System
+ Precision Instrument Interface

━━━━━━━━━━━━━━━━━━━━
FINAL ART DIRECTION
━━━━━━━━━━━━━━━━━━━━

必须让 HOME 和 SETTINGS 看起来像同一个完整操作系统。

严格继承参考图：

米白背景
黑色字体
橙色 Accent
HUD 圆弧
极细结构线
极大留白
工业感排版
中英双语
Monospace 系统信息
精密网格

界面整体应该：

安静
克制
精确
高级
理性
未来
专业

不要堆叠视觉元素。

不要为了“未来感”增加无意义科技装饰。

未来感主要通过：

排版
网格
HUD
比例
留白
状态信息
几何结构

来表达。
