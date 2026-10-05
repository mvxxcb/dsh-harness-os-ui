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

for (const must of ["'shell.overlay'", "'conversation.composer.dock'", "'settings.general.item'", "'dsh-harness-os-ui'", 'var(--dsw-']) {
  if (!clientSrc.includes(must)) fail(`lib/client.js 缺少必需内容：${must}`)
}

// 槽位 id 必须与主题插件的设置行 id 不同（否则会顶掉那一格）
if (clientSrc.includes("id: 'dsh-harness-os-theme'")) fail('设置行 id 与主题插件重名，会顶掉对方的设置格')

// ── 汇总 ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  · ${n}`)
if (problems.length) {
  console.error(`\n✗ check 失败（${problems.length} 项）：`)
  for (const p of problems) console.error(`   - ${p}`)
  process.exit(1)
}
console.log(`\n✓ 全部通过（${notes.length} 组检查）`)
