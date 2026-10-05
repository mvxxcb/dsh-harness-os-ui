/**
 * dsh-harness-os-ui — Host (node) half.
 *
 * 只做一件事：把设计稿页面按**严格白名单**提供给浏览器。
 *
 * 为什么是白名单而不是"拼路径再读文件"：设计稿是若干静态文件，路径集合在
 * 构建期就完全已知。既然已知，就没有任何理由让请求路径参与文件系统寻址 ——
 * 用「请求路径 → 文件」的精确查表，目录穿越在结构上不可能发生，而不是靠事后
 * 过滤 `..`（过滤总有拼写变体要追）。下面的 UI_FILES 就是全部可用文件。
 *
 * 每个路由都先过 `ctx.connection.requestRejection(req)` —— 与宿主 /api 网关
 * 同一套浏览器信任栅栏（DNS-rebinding / 跨站防护）。
 *
 * @module dsh-harness-os-ui
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UI_ROOT = path.join(PACKAGE_ROOT, 'ui')
const ROUTE_BASE = '/harness-os/ui'

/**
 * 请求路径 → 包内相对路径。**这是唯一的事实来源**：
 * 表里没有的路径一律 404，不存在"未列出但可读"的文件。
 */
const UI_FILES = new Map([
  ['', 'index.html'],
  ['/', 'index.html'],
  ['index.html', 'index.html'],
  ['home.html', 'home.html'],
  ['settings.html', 'settings.html'],
  ['styles/tokens.css', 'styles/tokens.css'],
  ['styles/base.css', 'styles/base.css'],
  ['styles/components.css', 'styles/components.css']
])

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml']
])

const name = 'dsh-harness-os-ui'
const inject = ['webServer', 'connection']

/**
 * @param ctx - host plugin context.
 */
function apply(ctx) {
  const disposers = []

  /** 浏览器信任栅栏；被拒时已经自行写好响应。 */
  const rejected = (req, res) => {
    try {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection === undefined || rejection === null) return false
      const code = typeof rejection === 'number' ? rejection : (rejection.status ?? 403)
      res.statusCode = code
      res.end()
      return true
    } catch (err) {
      // 栅栏本身抛错时按拒绝处理：宁可 403 也不要放行。
      res.statusCode = 403
      res.end()
      return true
    }
  }

  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_BASE,
    handler: (req, res) => {
      if (rejected(req, res)) return

      let raw = (req.url || '').split('?')[0]
      if (!raw.startsWith(ROUTE_BASE)) {
        res.statusCode = 404
        res.end()
        return
      }
      let rel = raw.slice(ROUTE_BASE.length)
      while (rel.startsWith('/')) rel = rel.slice(1)
      // 去掉末尾斜杠（`/harness-os/ui/` 与 `/harness-os/ui` 等价）
      while (rel.endsWith('/')) rel = rel.slice(0, -1)

      const mapped = UI_FILES.get(rel)
      if (mapped === undefined) {
        res.statusCode = 404
        res.end()
        return
      }

      // mapped 来自常量表，永远不含 '..'；再 resolve 一次只是为了让路径绝对。
      const target = path.resolve(UI_ROOT, mapped)
      if (target !== UI_ROOT && !target.startsWith(UI_ROOT + path.sep)) {
        res.statusCode = 403
        res.end()
        return
      }

      let body
      try {
        body = fs.readFileSync(target)
      } catch (err) {
        // 文件缺失（例如裁剪了 files 清单）只影响这一个页面。
        ctx.logger?.warn?.(`harness-os-ui: cannot read ${mapped}: ${err?.message ?? err}`)
        res.statusCode = 404
        res.end()
        return
      }

      res.statusCode = 200
      res.setHeader('content-type', MIME.get(path.extname(target)) ?? 'application/octet-stream')
      // 设计稿是本地静态资源，不要被缓存住以免改了看不到
      res.setHeader('cache-control', 'no-store')
      res.end(body)
    }
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* 卸载期失败不影响退出 */ }
    }
  })
}

export { apply, inject, name }
