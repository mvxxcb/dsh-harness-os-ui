/**
 * dsh-harness-os-ui — Web client half.
 *
 * 交付两件事：
 *   1. **帧层装饰（chrome）**：四角 L 型定位角标、制图辅助线、底边线 + 橙色节点、
 *      右下品牌标记。挂在宿主的 `shell.overlay` 上 —— 那是官方指定的"加性席位"，
 *      且**整层点击穿透**，所以装饰永远不会挡住应用。
 *   2. **完整设计预览**：设置里一个按钮，在新标签打开设计稿页面
 *      （由 host 半按白名单提供）。
 *
 * 三条硬约束（都是为了让这个插件"不可能搞坏界面"）：
 *
 *   a. **样式零全局污染**：没有 `*` reset、不碰 `body`、不写 `:root`；
 *      所有规则作用域在 `#harness-os-chrome` 下，类名统一 `hos-` 前缀。
 *   b. **只消费令牌，绝不覆盖令牌**。颜色一律走 `var(--dsw-alias-*)`，
 *      于是自动跟随当前主题（含 HARNESS OS 主题），也不会与
 *      `dsh-harness-os-theme` 的 overrideTokens 层争抢同一批属性。
 *   c. **不替换宿主外壳**。`main.conversation` 标注 replaceRisk =
 *      shadows-shipped-ui，替换它会顶掉宿主会话外壳；本插件不碰它。
 *      需要的装饰全部走 overlay 加性席位。
 */
window.__ModuleLoader__.load({
  id: 'dsh-harness-os-ui',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var React = null;
    try { React = require('react'); } catch (e) { /* 无 react 则只剩预览路由 */ }

    var SOURCE = 'dsh-harness-os-ui';
    var STORE_KEY = 'dsh-harness-os-ui:prefs';
    var DIAG_KEY = 'dsh-harness-os-ui:last';
    var STYLE_ID = 'dsh-harness-os-ui-style';
    var PREVIEW_URL = 'harness-os/ui/home.html';

    var DEFAULTS = { corners: true, guides: true, edge: true, brand: true, pills: true, hud: true, hero: false };

    /* ── 样式：全部作用域化，绝不出现全局选择器 ─────────────────────────── */
    var CSS = [
      '#harness-os-chrome{position:fixed;inset:0;pointer-events:none;z-index:0}',
      '#harness-os-chrome *{box-sizing:border-box}',

      /* 四角 L 型定位角标。
         线色用 label-tertiary 而不是 border-l4：实测证明 border-l4 在深色主题下是
         22% 白——1px 线铺在深色底上、再经一次截图缩放就完全看不见。
         "克制"不等于"不可见"：HUD 框线本来就需要能读出来。 */
      '#harness-os-chrome .hos-corner{position:absolute;width:16px;height:16px}',
      '#harness-os-chrome .hos-corner::before,',
      '#harness-os-chrome .hos-corner::after{content:"";position:absolute;background:var(--dsw-alias-label-tertiary,#8b8780)}',
      '#harness-os-chrome .hos-corner::before{width:16px;height:1px}',
      '#harness-os-chrome .hos-corner::after{width:1px;height:16px}',
      '#harness-os-chrome .hos-tl{top:16px;left:16px}',
      '#harness-os-chrome .hos-tr{top:16px;right:16px}',
      '#harness-os-chrome .hos-tr::before{right:0}',
      '#harness-os-chrome .hos-tr::after{right:0}',
      '#harness-os-chrome .hos-bl{bottom:16px;left:16px}',
      '#harness-os-chrome .hos-bl::before{bottom:0}',
      '#harness-os-chrome .hos-bl::after{bottom:0}',
      '#harness-os-chrome .hos-br{bottom:16px;right:16px}',
      '#harness-os-chrome .hos-br::before{bottom:0;right:0}',
      '#harness-os-chrome .hos-br::after{bottom:0;right:0}',

      /* 制图辅助线：同样提到 border-l4（深色下 22% 白）——6% 的 l1 实测不可见 */
      '#harness-os-chrome .hos-guide{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l4,rgba(20,19,15,.24))}',

      /* 底边线 + 橙色活动节点 */
      '#harness-os-chrome .hos-edge{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--dsw-alias-label-primary,#14130f);opacity:.85}',
      '#harness-os-chrome .hos-edge-node{position:absolute;bottom:-2px;left:32%;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary,#ff7500)}',

      /* 右下品牌标记：用 label-secondary 提高可读性（原本 tertiary 在深色下过暗）*/
      '#harness-os-chrome .hos-brand{position:absolute;right:16px;bottom:10px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#55524c)}',
      '#harness-os-chrome .hos-brand-mark{display:inline-block;width:22px;height:4px;margin-left:8px;vertical-align:middle;background:var(--dsw-alias-label-primary,#14130f)}',

      /* 快捷操作 + HUD 是**一叠**（输入卡 → 胶囊 → HUD → 进度线），
         整体锚在输入卡下方 —— 这正是设计稿里的堆叠顺序。
         上一版把它们拆成两块、HUD 钉死在视口底部，结果胶囊与 HUD 之间
         空了 366px（DSH 空白态的输入卡位置偏高），构图散掉。
         现在合成一叠，纵向间距由容器 gap 控制，不再各自为政。 */
      '#harness-os-dock{position:fixed;transform:translateX(-50%);width:720px;max-width:calc(100vw - 80px);display:flex;flex-direction:column;gap:14px;pointer-events:none;z-index:0}',
      '#harness-os-dock .hos-pills{display:flex;justify-content:center;gap:8px}',
      '#harness-os-dock .hos-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l3,rgba(20,19,15,.16));border-radius:999px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-secondary);cursor:default}',
      '#harness-os-dock .hos-pill--on{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '#harness-os-dock .hos-pill i{width:12px;height:12px;display:block;border:1px solid currentColor;border-radius:2px;opacity:.8}',
      '#harness-os-dock .hos-hud{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '#harness-os-dock .hos-hud-left{display:flex;align-items:center;gap:12px}',
      '#harness-os-dock .hos-hud-center{text-align:center}',
      '#harness-os-dock .hos-hud-right{display:flex;align-items:center;justify-content:flex-end;gap:8px}',
      '#harness-os-dock .hos-hud-accent{color:var(--dsw-alias-brand-primary)}',
      '#harness-os-dock .hos-sig{display:inline-flex;align-items:flex-end;gap:2px;height:12px}',
      '#harness-os-dock .hos-sig i{width:2px;background:var(--dsw-alias-brand-primary)}',
      '#harness-os-dock .hos-sig i:nth-child(1){height:4px;opacity:.45}',
      '#harness-os-dock .hos-sig i:nth-child(2){height:7px;opacity:.6}',
      '#harness-os-dock .hos-sig i:nth-child(3){height:9px;opacity:.8}',
      '#harness-os-dock .hos-sig i:nth-child(4){height:12px}',
      '#harness-os-dock .hos-bar{position:relative;height:2px;background:var(--dsw-alias-border-l2,rgba(20,19,15,.10))}',
      '#harness-os-dock .hos-bar b{position:absolute;inset:0 auto 0 0;width:34%;background:var(--dsw-alias-label-primary)}',
      '#harness-os-dock .hos-bar u{position:absolute;top:50%;left:34%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--dsw-alias-brand-primary)}',
      '#harness-os-dock .hos-brand-mark{display:inline-block;width:22px;height:4px;background:var(--dsw-alias-label-primary)}',

      /* ── Hero：叠加层（默认关闭）───────────────────────────────────────
         纯 CSS 圆弧：一个圆 + 透明边框 + 只给部分边着色 = 弧；配合不同半径与
         旋转角度做"错位圆弧"。这样颜色可以全部走 --dsw-* 令牌，
         而不必把颜色硬编码进 SVG data-URI（data-URI 里解析不了 CSS 变量）。 */
      '#harness-os-hero{position:fixed;transform:translateX(-50%);pointer-events:none;text-align:center;z-index:0}',
      '#harness-os-hero .hos-core{position:relative;width:300px;height:300px;margin:0 auto}',
      '#harness-os-hero .hos-ring{position:absolute;border-radius:50%;border:1px solid transparent}',
      '#harness-os-hero .hos-r1{inset:0;border-width:1.3px;border-top-color:var(--dsw-alias-label-primary);border-right-color:var(--dsw-alias-label-primary);transform:rotate(-34deg)}',
      '#harness-os-hero .hos-r2{inset:22px;border-top-color:var(--dsw-alias-label-dimmed);transform:rotate(118deg)}',
      '#harness-os-hero .hos-r3{inset:46px;border-left-color:var(--dsw-alias-border-l4);border-bottom-color:var(--dsw-alias-border-l4);transform:rotate(-96deg)}',
      '#harness-os-hero .hos-r4{inset:74px;border-top-color:var(--dsw-alias-label-tertiary);transform:rotate(196deg)}',
      '#harness-os-hero .hos-r5{inset:104px;border-bottom-color:var(--dsw-alias-label-dimmed);transform:rotate(-14deg)}',
      '#harness-os-hero .hos-cross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px}',
      '#harness-os-hero .hos-cross::before,#harness-os-hero .hos-cross::after{content:"";position:absolute;background:var(--dsw-alias-border-l4)}',
      '#harness-os-hero .hos-cross::before{left:0;right:0;top:50%;height:1px}',
      '#harness-os-hero .hos-cross::after{top:0;bottom:0;left:50%;width:1px}',
      '#harness-os-hero .hos-dot{position:absolute;border-radius:50%;background:var(--dsw-alias-brand-primary)}',
      '#harness-os-hero .hos-d1{width:5px;height:5px;left:70%;top:22%}',
      '#harness-os-hero .hos-d2{width:4px;height:4px;left:31%;top:66%;opacity:.75}',
      '#harness-os-hero .hos-d3{width:3px;height:3px;left:35%;top:26%;opacity:.5}',
      '#harness-os-hero .hos-title{margin-top:40px}',
      '#harness-os-hero .hos-title-cn{display:block;font-size:40px;font-weight:700;letter-spacing:.14em;color:var(--dsw-alias-label-primary)}',
      '#harness-os-hero .hos-title-en{display:block;margin-top:12px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}'
    ].join('\n');

    function readPrefs() {
      // 从 DEFAULTS **遍历**生成，而不是逐个手写键。
      // 手写版本曾经漏掉 pills / hero 两个键，导致快捷操作永远不渲染、
      // Hero 永远打不开 —— 表现为"开关点了没反应"的静默失效。
      // 遍历写法让"新增一个偏好"只需改 DEFAULTS 一处，不可能再漏。
      var out = {};
      for (var k in DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k];
      }
      try {
        var raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
          var p = JSON.parse(raw);
          if (p && typeof p === 'object') {
            for (var k2 in out) {
              if (Object.prototype.hasOwnProperty.call(p, k2) && typeof p[k2] === 'boolean') out[k2] = p[k2];
            }
          }
        }
      } catch (e) { /* 隐私模式 / 坏 JSON：用默认值 */ }
      return out;
    }

    function writePrefs(prefs) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (e) { /* 忽略 */ }
    }

    function installStyle() {
      if (typeof document === 'undefined' || !document.head) return;
      try {
        // 按 id 查找而非只看本地引用：客户端 HMR 会重新求值本模块，
        // 此时本地引用归零而旧 <style> 仍在 —— 只认引用会插入第二个。
        if (typeof document.getElementById === 'function' && document.getElementById(STYLE_ID)) return;
        var el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = CSS;
        document.head.appendChild(el);
      } catch (e) { /* 样式失败只是没装饰 */ }
    }

    function recordDiag(info) {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        // 普通诊断不带 layout，若直接整体覆盖会把抓到的空白态结构冲掉 ——
        // 所以没有新 layout 时沿用上一条里已有的那份。
        var keepLayout = info.layout || null;
        if (!keepLayout) {
          try {
            var prev = window.localStorage.getItem(DIAG_KEY);
            if (prev) {
              var p = JSON.parse(prev);
              if (p && p.layout) keepLayout = p.layout;
            }
          } catch (e2) { /* 忽略 */ }
        }
        window.localStorage.setItem(DIAG_KEY, JSON.stringify({
          slot: 'shell.overlay',
          id: SOURCE,
          prefs: info.prefs,
          overlayProbes: info.probes,
          layout: keepLayout,
          at: new Date().toISOString()
        }));
      } catch (e) { /* 忽略 */ }
    }

    /**
     * 空白态布局抓取：只有在**空白会话出现时**才写一份带 layout 的记录。
     *
     * 采样必须在目标状态真正渲染时进行 —— 有内容的会话里，空白态的标题
     * 根本不在 DOM 里，采不到。所以这里挂一个低频轮询，等空白态出现就抓一次，
     * 抓到即停（不需要用户一直停在空白页）。
     */
    function startBlankCapture(prefs) {
      try {
        if (typeof setInterval !== 'function') return;
        var tries = 0;
        var timer = setInterval(function () {
          tries++;
          if (tries > 40) { clearInterval(timer); return; }
          try {
            if (!isBlankSession()) return;
            var layout = probeLayoutTree();
            if (!layout) return;
            clearInterval(timer);
            recordDiag({ prefs: prefs, probes: probeOverlay(), layout: layout });
          } catch (e) { /* 继续等下一次 */ }
        }, 2000);
      } catch (e) { /* 抓取失败不影响装饰 */ }
    }

    /**
     * 探针：**必须证明"可见"，而不是"存在"**。
     *
     * 上一版只查 mounted / corners 计数，于是"元素在 DOM 里、但被祖先裁掉或压在
     * 不透明背景之下"会被误报成已生效。这里改为采集：
     *   - 自身与关键子节点的 getBoundingClientRect（0×0 或出屏即不可见）
     *   - 计算样式的 position / z-index / opacity / display / visibility
     *   - 逐级祖先的 rect 与 overflow / transform / contain（找出是谁在裁剪或承载）
     *   - dock 是否真的产出了子节点
     */
    function rectOf(el) {
      try {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      } catch (e) { return null; }
    }

    /**
     * 把"宿主空白态标题"那一带的真实 DOM 结构导出来。
     *
     * 为什么需要它：设计稿里标题是主角（大、居中、雷达环包着它），而宿主里它
     * 只是一行小字标，且**不是槽位** —— 没有 `data-slot` 锚点可用。要接管它
     * 就必须写结构选择器，而结构选择器绝不能靠猜（猜错就是把宿主界面搞坏）。
     * 所以先把真实节点、类名、层级取回来，再据此写一条最小规则。
     *
     * 纯诊断：只读 DOM、只写 localStorage，不改任何东西。
     */
    function probeHeroDom() {
      var out = {};
      try {
        // 取**最深层**的含「预览版」元素：上一版取了第一个匹配项，
        // 结果落在 <body> 上（祖先的 textContent 天然包含后代文本），信息为零。
        // 还要排除聊天流内部的节点 —— 对话正文同样在 DOM 里，上一版就被
        // 自己发的消息文本命中了，属于典型的"测到了被测对象之外的东西"。
        var nodes = document.querySelectorAll('div,span,h1,h2,h3,p,section,a');
        var best = null;
        var bestCount = Infinity;
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if ((el.textContent || '').indexOf('预览版') < 0) continue;
          if (el.closest && el.closest('[data-slot="conversation.chat.node"]') !== null) continue;
          if (el.closest && el.closest('[data-conversation-region="composer"]') !== null) continue;
          var n = el.querySelectorAll('*').length;
          if (n < bestCount) { bestCount = n; best = el; }
        }
        if (!best) { out.found = false; return out; }
        out.found = true;
        out.deepest = {
          tag: best.tagName.toLowerCase(),
          cls: String(best.className || '').slice(0, 70),
          descendants: bestCount,
          text: String(best.textContent || '').slice(0, 40),
          rect: rectOf(best)
        };
        // 逐级向上导出祖先链：这才是写结构选择器真正需要的东西
        var chain = [];
        var node = best;
        for (var d = 0; node && d < 7; d++) {
          chain.push({
            tag: node.tagName.toLowerCase(),
            cls: String(node.className || '').slice(0, 70),
            children: node.children ? node.children.length : 0,
            slot: node.getAttribute ? node.getAttribute('data-slot') : null,
            region: node.getAttribute ? node.getAttribute('data-conversation-region') : null,
            rect: rectOf(node)
          });
          node = node.parentElement;
        }
        out.chain = chain;
      } catch (e) {
        out.error = String((e && e.message) || e);
      }
      return out;
    }

    /**
     * 空白态的**完整布局树快照**。
     *
     * 从输入座（唯一在两种状态下都存在的稳定锚点）逐级向上走到 body，
     * 每一级连同**兄弟节点**一起导出：tag / className / data-slot / 包围盒 / 文本片段。
     *
     * 为什么不用文本匹配：上一版按「预览版」三字定位，结果命中了我自己发在
     * 对话里的那句话 —— 聊天正文也在 DOM 里。以稳定锚点为起点向上重建结构，
     * 才不会被"被测对象之外的东西"污染。
     *
     * 纯只读诊断，不改任何宿主节点。
     */
    function probeLayoutTree() {
      try {
        var seat = document.querySelector('[data-composer-seat]');
        if (!seat) return null;
        var levels = [];
        var node = seat;
        var depth = 0;
        while (node && node !== document.body && depth < 9) {
          var parent = node.parentElement;
          var sibs = [];
          if (parent) {
            for (var i = 0; i < parent.children.length && i < 9; i++) {
              var c = parent.children[i];
              sibs.push({
                tag: c.tagName.toLowerCase(),
                cls: String(c.className || '').slice(0, 44),
                slot: c.getAttribute ? c.getAttribute('data-slot') : null,
                rect: rectOf(c),
                txt: String(c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)
              });
            }
          }
          levels.push({
            tag: node.tagName.toLowerCase(),
            cls: String(node.className || '').slice(0, 44),
            slot: node.getAttribute ? node.getAttribute('data-slot') : null,
            rect: rectOf(node),
            siblings: sibs
          });
          node = parent;
          depth++;
        }
        return levels;
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    }

    function probeOverlay() {
      var out = {};
      try {
        if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return out;
        out.viewport = { w: window.innerWidth, h: window.innerHeight };

        var root = document.getElementById('harness-os-chrome');
        out.chromeExists = root !== null;
        if (root !== null) {
          var cs = getComputedStyle(root);
          out.chromeRect = rectOf(root);
          out.chromeStyle = {
            position: cs.position, zIndex: cs.zIndex, opacity: cs.opacity,
            display: cs.display, visibility: cs.visibility
          };
          out.corners = root.querySelectorAll('.hos-corner').length;
          out.cornerRect = rectOf(root.querySelector('.hos-corner'));
          var c1 = root.querySelector('.hos-corner');
          if (c1) out.cornerPaint = String(getComputedStyle(c1, '::before').backgroundColor || '').trim();
          out.guides = root.querySelectorAll('.hos-guide').length;
          var chain = [];
          var node = root.parentElement;
          var depth = 0;
          while (node && depth < 6) {
            var ns = getComputedStyle(node);
            chain.push({
              tag: node.tagName.toLowerCase(),
              cls: String(node.className || '').slice(0, 36),
              rect: rectOf(node),
              overflow: ns.overflowX + '/' + ns.overflowY,
              position: ns.position,
              zIndex: ns.zIndex,
              transform: ns.transform === 'none' ? 'none' : 'set',
              contain: ns.contain === 'none' ? 'none' : ns.contain
            });
            node = node.parentElement;
            depth++;
          }
          out.ancestors = chain;
        }

        var dock = document.getElementById('harness-os-dock');
        out.dockExists = dock !== null;
        if (dock !== null) {
          out.dockRect = rectOf(dock);
          out.dockChildren = dock.children.length;
          out.dockText = String(dock.textContent || '').slice(0, 60);
          // 定位诊断：position:fixed 的元素若落点远离视口，说明它的包含块
          // 不是视口（某级祖先带了 transform / filter / contain），必须把父链取回来。
          var ds = getComputedStyle(dock);
          out.dockStyle = {
            position: ds.position, left: ds.left, bottom: ds.bottom,
            zIndex: ds.zIndex, transform: ds.transform
          };
          var dp = dock.parentElement;
          out.dockParent = dp ? { id: dp.id, cls: String(dp.className || '').slice(0, 36), rect: rectOf(dp) } : null;
          var dgp = dp && dp.parentElement;
          out.dockGrandParent = dgp
            ? {
              id: dgp.id, cls: String(dgp.className || '').slice(0, 36),
              rect: rectOf(dgp), transform: getComputedStyle(dgp).transform,
              contain: getComputedStyle(dgp).contain, filter: getComputedStyle(dgp).filter
            }
            : null;
        }
        var pills = document.getElementById('harness-os-pills');
        out.pillsExists = pills !== null;
        if (pills !== null) out.pillsRect = rectOf(pills);
        var hudEl = document.getElementById('harness-os-hero');
        out.heroExists = hudEl !== null;
        if (hudEl !== null) out.heroRect = rectOf(hudEl);
        out.dockSlotNodes = document.querySelectorAll('[data-slot="conversation.composer.dock"]').length;
        out.composerSeatRect = rectOf(document.querySelector('[data-composer-seat]'));
        out.heroDom = probeHeroDom();
      } catch (e) {
        out.error = String((e && e.message) || e);
      }
      return out;
    }

    /* ── 一个极小的订阅表：设置行改动后让 overlay 重画 ─────────────────── */
    var listeners = [];
    function subscribe(fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
    function bump() {
      for (var i = listeners.length - 1; i >= 0; i--) {
        try { listeners[i](); } catch (e) { /* 忽略单个订阅者 */ }
      }
    }

    /**
     * 空会话判定：**保守**。
     * 只要发现任一 `[data-slot="conversation.chat.node"]` 带非空文本，就认为
     * "有对话内容"。任何不确定（异常、取不到节点）都返回 false —— 宁可少显示
     * Hero，也绝不把它盖在真实对话上。
     */
    function isBlankSession() {
      try {
        var nodes = document.querySelectorAll('[data-slot="conversation.chat.node"]');
        for (var i = 0; i < nodes.length; i++) {
          var t = nodes[i].textContent;
          if (t && t.trim() !== '') return false;
        }
        return true;
      } catch (e) { return false; }
    }

    /**
     * Hero 的落位与可见性（默认关闭）。
     *
     * **位置实测，不猜中心**：读 `[data-composer-seat]`（DSH 文档化的稳定锚点）
     * 的包围盒，把 Hero 居中在输入座正上方。直接按视口 50% 居中会因为左侧栏
     * 的存在而整体偏左 —— 这是猜出来的定位必然踩的坑。
     */
    function useAnchors(enabled) {
      var EMPTY = { cx: null, top: null, bottom: null, vh: 0, blank: false };
      var pair = React.useState(EMPTY);
      var state = pair[0];
      var setState = pair[1];
      React.useEffect(function () {
        if (!enabled) { setState(EMPTY); return; }
        var measure = function () {
          // bottom 也要取：胶囊要挂在输入卡**下缘**之下，而不是上缘之上
          var next = { cx: null, top: null, bottom: null, vh: window.innerHeight, blank: isBlankSession() };
          try {
            var seat = document.querySelector('[data-composer-seat]');
            if (seat) {
              var r = seat.getBoundingClientRect();
              next.cx = Math.round(r.left + r.width / 2);
              next.top = Math.round(r.top);
              next.bottom = Math.round(r.bottom);
            }
          } catch (e) { /* 保持 null */ }
          setState(function (prev) {
            // 只在真正变化时更新，避免定时器导致无意义重渲染
            if (prev.cx === next.cx && prev.top === next.top && prev.bottom === next.bottom
              && prev.vh === next.vh && prev.blank === next.blank) return prev;
            return next;
          });
        };
        measure();
        var timer = setInterval(measure, 1200);
        window.addEventListener('resize', measure);
        return function () {
          clearInterval(timer);
          window.removeEventListener('resize', measure);
        };
      }, [enabled]);
      return state;
    }

    /**
     * Hero：雷达环，叠加在空白会话上（**默认关闭**）。
     *
     * **刻意不含标题。** 第一版带了自己那行「探索未至之境」，结果截图里出现
     * 两行一样的字 —— 因为宿主空白态自带的标题本来就是「探索未至之境」，
     * 我那行只是把同一句话又叠了一遍。重复是自己的实现造成的，不是宿主的。
     * 去掉标题后构图反而更接近设计稿：雷达环在上，标题（宿主的）在下。
     *
     * 定位按**下缘**而不是中心：按中心定位时整块高约 406px，下缘会算到
     * seat.top+17，正好压住下方的胶囊与 HUD（占 seat.top-75 ~ seat.top-12）。
     */
    function Hero() {
      var prefs = readPrefs();
      var st = useAnchors(prefs.hero === true);
      if (prefs.hero !== true || !st.blank || st.cx === null || st.top === null) return null;
      return React.createElement('div', {
        id: 'harness-os-hero',
        // 下缘固定在输入座上缘之上 116px，给下方的胶囊/HUD 留出确定的空间
        style: { left: st.cx + 'px', bottom: Math.max(0, st.vh - st.top + 116) + 'px' }
      },
        React.createElement('div', { className: 'hos-core' },
          React.createElement('i', { className: 'hos-ring hos-r1' }),
          React.createElement('i', { className: 'hos-ring hos-r2' }),
          React.createElement('i', { className: 'hos-ring hos-r3' }),
          React.createElement('i', { className: 'hos-ring hos-r4' }),
          React.createElement('i', { className: 'hos-ring hos-r5' }),
          React.createElement('i', { className: 'hos-cross' }),
          React.createElement('i', { className: 'hos-dot hos-d1' }),
          React.createElement('i', { className: 'hos-dot hos-d2' }),
          React.createElement('i', { className: 'hos-dot hos-d3' })
        )
      );
    }

    function Chrome() {
      var prefs = readPrefs();
      if (React && typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(0);
        var setV = pair[1];
        React.useEffect(function () {
          return subscribe(function () { setV(function (n) { return n + 1; }); });
        }, []);
      }

      var kids = [];
      if (prefs.corners) {
        kids.push(React.createElement('i', { key: 'tl', className: 'hos-corner hos-tl' }));
        kids.push(React.createElement('i', { key: 'tr', className: 'hos-corner hos-tr' }));
        kids.push(React.createElement('i', { key: 'bl', className: 'hos-corner hos-bl' }));
        kids.push(React.createElement('i', { key: 'br', className: 'hos-corner hos-br' }));
      }
      if (prefs.guides) {
        kids.push(React.createElement('i', { key: 'g1', className: 'hos-guide', style: { left: '25%' } }));
        kids.push(React.createElement('i', { key: 'g2', className: 'hos-guide', style: { left: '75%' } }));
      }
      if (prefs.edge) {
        kids.push(React.createElement('i', { key: 'edge', className: 'hos-edge' }));
        kids.push(React.createElement('i', { key: 'node', className: 'hos-edge-node' }));
      }
      if (prefs.brand) {
        kids.push(React.createElement('span', { key: 'brand', className: 'hos-brand' },
          'HARNESS OS',
          React.createElement('i', { className: 'hos-brand-mark' })
        ));
      }
      if (prefs.pills === true || prefs.hud === true) kids.push(React.createElement(Dock, { key: 'dock' }));
      if (prefs.hero === true) kids.push(React.createElement(Hero, { key: 'hero' }));
      return React.createElement('div', { id: 'harness-os-chrome' }, kids);
    }

    /**
     * Dock：快捷操作胶囊 + HUD 状态带 + 进度线 —— **一叠**，锚在输入卡下方。
     *
     * **只在空白会话显示。** 有内容的会话里输入卡下方没有任何空闲区域
     * （实测输入座一直顶到视口底部），任何悬浮元素都会盖住真实消息。
     *
     * 三块合成一叠而不是各自钉死在不同锚点上：拆开时胶囊与 HUD 之间会空出
     * 366px（DSH 空白态的输入卡位置偏高），构图散掉；设计稿里它们本来就是
     * 紧挨着的一叠。
     */
    function Dock() {
      var prefs = readPrefs();
      var on = prefs.pills === true || prefs.hud === true;
      var st = useAnchors(on);
      if (React && typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(0);
        var setV = pair[1];
        React.useEffect(function () {
          return subscribe(function () { setV(function (n) { return n + 1; }); });
        }, []);
      }
      if (!on || !st.blank || st.cx === null || st.bottom === null) return null;

      var kids = [];

      if (prefs.pills === true) {
        kids.push(React.createElement('div', { key: 'pills', className: 'hos-pills' },
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '文件上传'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '知识库'),
          React.createElement('span', { className: 'hos-pill hos-pill--on' }, React.createElement('i'), '生成图像')
        ));
      }

      if (prefs.hud === true) {
        kids.push(React.createElement('div', { key: 'hud', className: 'hos-hud' },
          React.createElement('span', { className: 'hos-hud-left' },
            React.createElement('span', { className: 'hos-sig' },
              React.createElement('i'), React.createElement('i'), React.createElement('i'), React.createElement('i')
            ),
            React.createElement('span', null, '[ 01 / 06 ] HOME')
          ),
          React.createElement('span', { className: 'hos-hud-center' }, '等待用户输入… / AWAITING USER INPUT'),
          React.createElement('span', { className: 'hos-hud-right' },
            React.createElement('span', { className: 'hos-hud-accent' }, 'REV 0.1.0'),
            React.createElement('span', { className: 'hos-brand-mark' })
          )
        ));
        kids.push(React.createElement('div', { key: 'bar', className: 'hos-bar' },
          React.createElement('b'), React.createElement('u')
        ));
      }

      if (kids.length === 0) return null;
      return React.createElement('div', {
        id: 'harness-os-dock',
        // 输入座在卡片下方还带一段内距，减掉 28px 让胶囊贴回卡片下缘附近
        style: { left: st.cx + 'px', top: (st.bottom - 28) + 'px' }
      }, kids);
    }

    function apply(ctx) {
      installStyle();

      var prefs = readPrefs();
      var slots = ctx.get('slots');
      var locale = ctx.get('locale');
      var disposers = [];

      /* 帧层装饰：shell.overlay 是加性、点击穿透的官方席位。
         order 取负，让它排在自带条目之前（也就是被 toast 之类盖住），
         装饰本来就该在最底下。 */
      if (React && slots && typeof slots.register === 'function') {
        try {
          disposers.push(slots.register(
            { name: 'shell.overlay', id: SOURCE, order: -10 },
            function () { return React.createElement(Chrome); }
          ));
        } catch (e) { /* 席位冲突等：仅失去装饰 */ }
      }

      /* 注意：快捷操作与 HUD **不再**注册到 conversation.composer.dock。
         实测证明那个席位虽然加性，但落点没有余量（见 Dock 的注释），
         因此它们改由上面同一个浮层条目承载。 */

      /* 设置行：id 与宿主自带条目区分开（order 22 接在主题行之后）*/
      var I18N = {
        zh: {
          title: 'HARNESS OS 界面',
          corners: '四角定位角标', guides: '制图辅助线', edge: '底边线',
          brand: '品牌标记', pills: '快捷操作', hud: 'HUD 文本带', hero: 'Hero 雷达环',
          preview: '打开设计预览',
          hint: '全部为加性叠加：帧层与快捷操作/HUD 均为点击穿透浮层，不替换宿主外壳、不改变宿主布局。颜色跟随当前主题。'
        },
        en: {
          title: 'HARNESS OS shell',
          corners: 'Corner marks', guides: 'Drafting guides', edge: 'Edge line',
          brand: 'Brand mark', pills: 'Quick actions', hud: 'HUD text strip', hero: 'Hero rings',
          preview: 'Open design preview',
          hint: 'Everything is an additive, click-through overlay: the host shell and its layout are never modified. Colors follow the active theme.'
        }
      };
      var translate = function (k) { return (I18N.zh && I18N.zh[k]) || k; };

      if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
        try {
          locale.register(SOURCE, 'zh', I18N.zh);
          locale.register(SOURCE, 'en', I18N.en);
          var bound = locale.bind(SOURCE);
          translate = function (k) { return bound(k); };
        } catch (e) { /* 词典失败不影响装饰 */ }
      }

      if (React && slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
        try {
          var Row = function () {
            var force = React.useState(0)[1];
            var rerender = function () { force(function (n) { return n + 1; }); };
            var cur = readPrefs();
            var patch = function (key) {
              var next = readPrefs();
              next[key] = cur[key] === false;
              writePrefs(next);
              bump();
              rerender();
            };
            var box = { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' };
            var line = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
            var chip = function (on) {
              return {
                padding: '4px 10px', cursor: 'pointer', borderRadius: '999px',
                border: '1px solid ' + (on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'),
                color: on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
                background: 'transparent', font: 'inherit'
              };
            };
            var openPreview = function () {
              try {
                var url = new URL(PREVIEW_URL, (typeof document !== 'undefined' && document.baseURI) || undefined).href;
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch (e) { /* 打不开就算了 */ }
            };
            return React.createElement('div', { style: box, 'data-hos': 'ui-settings-row' },
              React.createElement('div', { style: line },
                React.createElement('strong', { style: { fontWeight: 600 } }, translate('title')),
                React.createElement('button', { type: 'button', style: chip(false), onClick: openPreview },
                  translate('preview'))
              ),
              React.createElement('div', { style: line },
                ['corners', 'guides', 'edge', 'brand', 'pills', 'hud', 'hero'].map(function (k) {
                  return React.createElement('button', {
                    key: k, type: 'button', style: chip(cur[k] !== false), onClick: function () { patch(k); }
                  }, translate(k));
                })
              ),
              React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' } },
                translate('hint'))
            );
          };

          slots.inject('settings.general.item', function () {
            return slots.register(
              { name: 'settings.general.item', id: SOURCE, order: 22 },
              function () { return React.createElement(Row); }
            );
          });
        } catch (e) { /* 设置行失败不影响装饰 */ }
      }

      /* 诊断：等待装饰真正落到 DOM 后读回一次；并开启空白态布局抓取 */
      try {
        if (typeof setTimeout === 'function') {
          setTimeout(function () { recordDiag({ prefs: readPrefs(), probes: probeOverlay() }); }, 600);
        }
        startBlankCapture(prefs);
      } catch (e) { /* 忽略 */ }

      ctx.effect(function () {
        return function () {
          for (var i = 0; i < disposers.length; i++) {
            try { disposers[i](); } catch (e) { /* 忽略 */ }
          }
          try {
            var el = typeof document !== 'undefined' && document.getElementById(STYLE_ID);
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } catch (e) { /* 忽略 */ }
        };
      });
    }

    exports.apply = apply;
    exports.inject = ['slots', 'locale'];
    return module.exports;
  }
});
