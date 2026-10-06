#!/usr/bin/env node
/**
 * 提交前门禁：`node scripts/check.mjs`
 *
 * 它把「安装到真实客户端会不会出问题」这件事变成可重复执行的断言，
 * 而不是一次性的人工检查。六组：
 *
 *   1. 清单形态：无 @deepseek-ai/dsh-* peer（否则启动期预检会静默禁用整行）
 *   2. 路由白名单：UI_FILES 的每一项都真实存在，目录下没有"漏列出"的文件
 *   3. 路由命名空间：不与已装插件（/sidebar、/dsh-startup）冲突
 *   4. 样式作用域：CSS 数组里**每一条**规则都必须以 #harness-os-chrome 开头
 *      —— 这是防止"整页级 reset 毁掉宿主布局"的核心不变量
 *   5. 令牌纪律：客户端不得写设计令牌（不覆盖 documentElement/body 样式），
 *      颜色只能 var(--dsw-*) 消费；也不得调用 theme.overrideTokens
 *   6. 跨插件资源占用：与 profile 里已装插件逐项比对 路由 / 全局变量 / 槽位 id
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []
const fail = (m) => problems.push(m)

const read = (p) => readFileSync(join(root, p), 'utf8')

// ── 1. 清单形态 ────────────────────────────────────────────────────────────
const pkg = JSON.parse(read('package.json'))
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  const deps = pkg[field]
  if (!deps) continue
  for (const name of Object.keys(deps)) {
    if (name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')) {
      fail(`${field} 声明了 ${name} —— 启动期 peer 预检不满足时会静默禁用整行，本插件刻意不声明`)
    }
  }
}
if (!pkg.dsh?.bundle?.patch) fail('package.json 缺少 dsh.bundle.patch')
if (pkg.dsh?.client?.platform !== 'web') fail('package.json 缺少 dsh.client.platform = web')
if (!existsSync(join(root, pkg.dsh.bundle.patch))) fail(`dsh.bundle.patch 指向的文件不存在：${pkg.dsh.bundle.patch}`)

// 发布清单必须覆盖运行期真正读取的目录
for (const need of ['lib', 'ui']) {
  if (!Array.isArray(pkg.files) || !pkg.files.includes(need)) fail(`package.json files 缺少 "${need}"`)
}

// ── 2. 路由白名单完整性 ────────────────────────────────────────────────────
const hostSrc = read('lib/index.js')
const routeBase = (hostSrc.match(/const ROUTE_BASE = '([^']+)'/) || [])[1]
if (routeBase !== '/harness-os/ui') fail(`ROUTE_BASE 意外：${routeBase}`)

const listed = new Set()
const mapBlock = hostSrc.slice(hostSrc.indexOf('const UI_FILES'), hostSrc.indexOf('const MIME'))
for (const m of mapBlock.matchAll(/\['([^']*)',\s*'([^']+)'\]/g)) listed.add(m[2])

const onDisk = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else onDisk.push(relative(join(root, 'ui'), p).replace(/\\/g, '/'))
  }
})(join(root, 'ui'))

for (const rel of listed) {
  if (!existsSync(join(root, 'ui', rel))) fail(`UI_FILES 列出的文件不存在：ui/${rel}`)
}
for (const rel of onDisk) {
  if (!listed.has(rel)) fail(`ui/${rel} 存在于磁盘但未列入 UI_FILES —— 访问不到，也说明清单过期`)
}
notes.push(`UI_FILES：${listed.size} 条，磁盘 ${onDisk.length} 个文件，一一对应`)

// ── 3/6. 跨插件资源占用 ────────────────────────────────────────────────────
const profile = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules')
const OURS = {
  routes: [routeBase],
  globals: ['__ModuleLoader__'],   // 宿主自己提供的加载器，不算占用
  slots: ['shell.overlay', 'settings.general.item'],
  ids: ['dsh-harness-os-ui', 'harness-os-chrome', 'dsh-harness-os-ui-style']
}
const alsoOurs = new Set(['harness-os-chrome', 'dsh-harness-os-ui-style', 'dsh-harness-os-ui'])

if (existsSync(profile)) {
  const pkgs = readdirSync(profile).filter((n) => n.startsWith('dsh-') && n !== pkg.name)
  const conflicts = []
  for (const name of pkgs) {
    const lib = join(profile, name, 'lib')
    if (!existsSync(lib)) continue
    const blob = []
    ;(function walk(dir) {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(js|mjs|cjs)$/.test(e)) {
          try { blob.push(readFileSync(p, 'utf8')) } catch { /* 忽略不可读 */ }
        }
      }
    })(lib)
    const text = blob.join('\n')
    for (const r of OURS.routes) {
      if (text.includes(`'${r}`) || text.includes(`"${r}`) || text.includes('`' + r)) {
        conflicts.push(`${name} 也使用了路由前缀 ${r}`)
      }
    }
    for (const id of OURS.ids) {
      if (text.includes(`'${id}'`) || text.includes(`"${id}"`)) {
        conflicts.push(`${name} 也使用了标识 ${id}`)
      }
    }
  }
  if (conflicts.length) conflicts.forEach(fail)
  else notes.push(`与 ${pkgs.length} 个已装插件比对：路由 / 标识 无重叠`)
} else {
  notes.push('未找到 desktop profile，跳过跨插件占用比对')
}

// ── 4/5. 客户端不变量 ──────────────────────────────────────────────────────
const clientSrc = read('lib/client.js')

const cssStart = clientSrc.indexOf('var CSS = [')
const cssEnd = clientSrc.indexOf("].join('\\n')", cssStart)
// 允许的作用域根：每一条规则都必须挂在其中之一，绝不允许裸选择器。
const SCOPES = ['#harness-os-chrome', '#harness-os-dock', '#harness-os-hero']
if (cssStart < 0 || cssEnd < 0) {
  fail('lib/client.js 里找不到 CSS 数组')
} else {
  const block = clientSrc.slice(cssStart, cssEnd)
  const lines = [...block.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter((s) => s.trim() !== '')
  const bad = lines.filter((l) => !SCOPES.some((s) => l.trimStart().startsWith(s)))
  if (bad.length) {
    fail(`CSS 有 ${bad.length} 条规则未以 ${SCOPES.join(' / ')} 开头（会污染宿主样式）：${bad.slice(0, 3).join(' | ')}`)
  } else {
    notes.push(`CSS 作用域：${lines.length} 条规则全部限定在 ${SCOPES.length} 个作用域根内`)
  }
}

// 剥掉注释再扫：注释里提到某个 API 名不等于调用了它（第一版校验就栽在这上面）。
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
const clientCode = stripComments(clientSrc)

for (const forbidden of [
  ['documentElement.style', '写了 documentElement 的内联样式（令牌应只消费不覆盖）'],
  ['body.style', '写了 body 的内联样式（会污染宿主）'],
  ['.overrideTokens(', '调用了 theme.overrideTokens（令牌覆盖是主题插件的职责，重复叠加会互相覆盖）'],
  ['theme.register(', '注册了主题（同上）']
]) {
  if (clientCode.includes(forbidden[0])) fail(forbidden[1])
}

// 通配/元素选择器不再单独扫描 —— "每条 CSS 规则都必须以 #harness-os-chrome 开头"
// 是更强的不变量：`#harness-os-chrome *{…}` 合法，裸 `*{…}` 会在上面那一关就被拦下。

for (const must of ["'shell.overlay'", "'settings.general.item'", "'dsh-harness-os-ui'", 'var(--dsw-']) {
  if (!clientSrc.includes(must)) fail(`lib/client.js 缺少必需内容：${must}`)
}

// 反向断言：快捷操作/HUD 不得重新挂回 conversation.composer.dock。
// 实测该席位落点没有余量（dockRect y 983→1062 vs 输入座 881→1066），
// 元素会"存在、尺寸正常、但视觉上看不见"。若有人改回去，这里拦住。
if (/slots\.register\(\s*\{\s*name:\s*'conversation\.composer\.dock'/.test(clientCode)) {
  fail('快捷操作/HUD 重新挂回了 conversation.composer.dock —— 该席位落点无余量，实测不可见')
}

// 槽位 id 必须与主题插件的设置行 id 不同（否则会顶掉那一格）
if (clientSrc.includes("id: 'dsh-harness-os-theme'")) fail('设置行 id 与主题插件重名，会顶掉对方的设置格')

// ── 5.5 诊断门控：发布版不允许任何 localStorage 写入 ───────────────────────
// HANDOFF 3.1：probeOverlay / probeLayoutTree / recordDiag / startBlankCapture
// 都只为调试服务（每次写 2–8 KB）。它们必须收拢在 runDiagnostics 一个入口之后，
// 由编译期常量 DEBUG_DIAG=false 与运行期调试键双重拦截。这里的断言防止
// 有人把诊断调用挪回 apply/渲染路径，让发布版重新开始写 localStorage。
if (!/var DEBUG_DIAG = false/.test(clientCode)) {
  fail('DEBUG_DIAG 必须显式声明为 var DEBUG_DIAG = false（发布形态；打开诊断走调试键，不是改这里）')
}
if (!clientCode.includes('if (!DEBUG_DIAG) return false')) {
  fail('diagEnabled 缺少 DEBUG_DIAG 常量闸 —— 诊断只受运行期开关保护是不够的')
}
const diagStart = clientCode.indexOf('function runDiagnostics')
const listenersStart = clientCode.indexOf('var listeners = []')
if (diagStart < 0 || listenersStart < 0 || diagStart > listenersStart) {
  fail('找不到 runDiagnostics（诊断调用必须集中在此函数内，并受双闸保护）')
} else {
  if (!clientCode.slice(diagStart, listenersStart).includes('if (!diagEnabled()) return')) {
    fail('runDiagnostics 入口缺少 diagEnabled() 拦截')
  }
  const findCalls = (name) => {
    const sites = []
    let from = 0
    for (;;) {
      const i = clientCode.indexOf(`${name}(`, from)
      if (i < 0) break
      from = i + 1
      if (clientCode.slice(Math.max(0, i - 9), i).endsWith('function ')) continue // 定义处
      sites.push(i)
    }
    return sites
  }
  const runRegion = [diagStart, listenersStart]
  const inRegion = (i, r) => r !== null && i >= r[0] && i < r[1]
  const outsideDiag = findCalls('recordDiag').filter((i) => !inRegion(i, runRegion))
  if (outsideDiag.length) fail('recordDiag 被 runDiagnostics 之外的代码调起 —— 发布版会写 localStorage')

  // localStorage 写入只允许出现在 writePrefs（用户偏好）与 recordDiag（已门控）里
  const writeSites = []
  let wfrom = 0
  for (;;) {
    const i = clientCode.indexOf('.setItem(', wfrom)
    if (i < 0) break
    wfrom = i + 1
    writeSites.push(i)
  }
  const wpStart = clientCode.indexOf('function writePrefs')
  const wpEnd = clientCode.indexOf('function installStyle')
  const rdStart = clientCode.indexOf('function recordDiag')
  const rdEnd = clientCode.indexOf('function rectOf')
  const writeRegions = [
    wpStart >= 0 && wpEnd > wpStart ? [wpStart, wpEnd] : null,
    rdStart >= 0 && rdEnd > rdStart ? [rdStart, rdEnd] : null
  ]
  const badWrites = writeSites.filter((i) => !writeRegions.some((r) => inRegion(i, r)))
  if (badWrites.length) {
    fail(`client.js 存在 writePrefs / recordDiag 之外的 localStorage 写入（${badWrites.length} 处）`)
  } else if (!outsideDiag.length) {
    notes.push('诊断门控：DEBUG_DIAG=false 双闸 + 诊断调用/写入点全部收拢在白名单函数内')
  }
}

// ── 7. 偏好键一致性 ────────────────────────────────────────────────────────
// 曾经的缺陷：readPrefs 手写初始化只列了 5 个键，漏掉后加的 pills / hero，
// 于是 prefs.pills 恒为 undefined（快捷操作永不渲染）、patch('hero') 恒写 false
// （Hero 永远打不开）—— 开关点了没反应的静默失效。
// 这里同时钉住两处，让"新增偏好只改 DEFAULTS"成为可验证的事实。
const defaultsMatch = clientCode.match(/var DEFAULTS = \{([^}]*)\}/)
if (!defaultsMatch) {
  fail('找不到 DEFAULTS 定义')
} else {
  const defaultsKeys = [...defaultsMatch[1].matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map((m) => m[1]).sort()

  const rpStart = clientCode.indexOf('function readPrefs')
  const rpEnd = clientCode.indexOf('function writePrefs')
  const readPrefsBody = rpStart >= 0 && rpEnd > rpStart ? clientCode.slice(rpStart, rpEnd) : ''
  if (!readPrefsBody) fail('找不到 readPrefs')
  else if (!readPrefsBody.includes('in DEFAULTS')) {
    fail('readPrefs 未遍历 DEFAULTS —— 手写键列表会随 DEFAULTS 增长而静默漏键')
  }

  const toggleMatch = clientCode.match(/\[\s*((?:'[a-zA-Z]+'\s*,\s*)*'[a-zA-Z]+')\s*\]\s*\.map/)
  if (!toggleMatch) {
    fail('找不到设置行开关列表')
  } else {
    const toggleKeys = [...toggleMatch[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]).sort()
    const same = toggleKeys.length === defaultsKeys.length && toggleKeys.every((k, i) => k === defaultsKeys[i])
    if (!same) {
      fail(`设置行开关列表与 DEFAULTS 不一致：DEFAULTS=[${defaultsKeys.join(',')}] 开关=[${toggleKeys.join(',')}]`)
    } else if (readPrefsBody.includes('in DEFAULTS')) {
      notes.push(`偏好键一致：DEFAULTS、readPrefs、设置行开关同为 ${defaultsKeys.length} 个键`)
    }
  }
}

// ── 汇总 ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  · ${n}`)
if (problems.length) {
  console.error(`\n✗ check 失败（${problems.length} 项）：`)
  for (const p of problems) console.error(`   - ${p}`)
  process.exit(1)
}
console.log(`\n✓ 全部通过（${notes.length} 组检查）`)
