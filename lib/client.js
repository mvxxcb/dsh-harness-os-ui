/**
 * dsh-harness-os-ui — Web client half.
 *
 * 交付两件事：
 *   1. **帧层装饰（chrome）**：四角 L 型定位角标、制图辅助线、底边线 + 橙色节点、
 *      品牌标记。挂在宿主的 `shell.overlay` 上 —— 那是官方指定的"加性席位"，
 *      且**整层点击穿透**，所以装饰永远不会挡住应用。
 *   2. **完整设计预览**：设置里一个按钮，在新标签打开设计稿页面
 *      （由 host 半按白名单提供）。
 *
 * 四条硬约束（都是为了让这个插件"不可能搞坏界面"）：
 *
 *   a. **样式零全局污染**：没有 `*` reset、不碰 `body`、不写 `:root`；
 *      所有规则作用域在 `#harness-os-chrome` 下，类名统一 `hos-` 前缀。
 *   b. **只消费令牌，绝不覆盖令牌**。颜色一律走 `var(--dsw-alias-*)`，
 *      于是自动跟随当前主题（含 HARNESS OS 主题），也不会与
 *      `dsh-harness-os-theme` 的 overrideTokens 层争抢同一批属性。
 *   c. **不替换宿主外壳**。`main.conversation` 标注 replaceRisk =
 *      shadows-shipped-ui，替换它会顶掉宿主会话外壳；本插件不碰它。
 *      需要的装饰全部走 overlay 加性席位。
 *   d. **发布版零诊断写入**。所有探针（probeOverlay / probeLayoutTree /
 *      recordDiag / startBlankCapture）收拢在 runDiagnostics 一个入口之后，
 *      由编译期常量 DEBUG_DIAG 与运行期调试键双重门控；默认连定时器都不起。
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
    var DEBUG_KEY = 'dsh-harness-os-ui:debug';
    var DIAG_KEY = 'dsh-harness-os-ui:last';
    var STYLE_ID = 'dsh-harness-os-ui-style';
    var PREVIEW_URL = 'harness-os/ui/home.html';

    var DEFAULTS = { corners: true, guides: true, edge: true, brand: true, pills: true, hud: true, hero: false, topbar: true, takeover: true };

    /**
     * 诊断总闸（发布形态必须为 false，门禁有断言）。
     * 置 true 且 localStorage['dsh-harness-os-ui:debug'] === '1' 时，
     * runDiagnostics 才会采集几何/布局树并写 localStorage —— 那条链路目前
     * 读不回来（leveldb 压缩 + 多帧 zstd，见 HANDOFF 3.8），只为方案 B 的
     * 采样改造留一口活口，平时连定时器都不允许存在。
     */
    var DEBUG_DIAG = false;

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

      /* 制图辅助线：同样提到 border-l4（深色下 22% 白）——6% 的 l1 实测不可见。
         水平位置不再写死：left 由 Chrome 按输入座实测边缘内联给出。 */
      '#harness-os-chrome .hos-guide{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l4,rgba(20,19,15,.24))}',

      /* 底边线 + 橙色活动节点 */
      '#harness-os-chrome .hos-edge{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--dsw-alias-label-primary,#14130f);opacity:.85}',
      '#harness-os-chrome .hos-edge-node{position:absolute;bottom:-2px;left:32%;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary,#ff7500)}',

      /* 品牌标记：水平位置由 Chrome 按输入座左缘内联给出（内容区左下角）。
         曾经固定 right:16px;bottom:10px —— 正好压在 dsh-whale-widget
         （.dshwv-root 固定 right:0;bottom:0，边长最大 250px，z-index 9999）
         的地盘里，用户截图证实被完全遮住。 */
      '#harness-os-chrome .hos-brand{position:absolute;bottom:10px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#55524c)}',
      '#harness-os-chrome .hos-brand-mark{display:inline-block;width:22px;height:4px;margin-left:8px;vertical-align:middle;background:var(--dsw-alias-label-primary,#14130f)}',

      /* 快捷操作胶囊：一叠，锚在输入卡下方（设计稿顺序：输入卡 → 胶囊）。
         HUD/进度线不再跟在这叠里 —— 设计稿里它们在内容区**最底部**，
         由下面的 hos-bottom 独立承载（上一版合成一叠是因为 HUD 钉死在
         视口底部而胶囊跟输入卡，两者高差 366px 显得散；现在底部带整体
         对齐输入座左右边缘，构图重新收拢）。 */
      '#harness-os-dock{position:fixed;transform:translateX(-50%);width:720px;max-width:calc(100vw - 80px);pointer-events:none;z-index:0}',
      '#harness-os-dock .hos-pills{display:flex;justify-content:center;gap:8px}',
      '#harness-os-dock .hos-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l3,rgba(20,19,15,.16));border-radius:999px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-secondary);cursor:default}',
      '#harness-os-dock .hos-pill--on{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '#harness-os-dock .hos-pill i{width:12px;height:12px;display:block;border:1px solid currentColor;border-radius:2px;opacity:.8}',

      /* ── 顶部系统信息条 + 底部 HUD 带（仅空白会话）──────────────────
         两者都是 #harness-os-chrome 的子节点，继续走同一作用域根，不新增
         白名单根。水平位置由 Chrome 按输入座实测边缘内联给出，与辅助线同源。 */
      '#harness-os-chrome .hos-topbar{position:absolute;top:14px;display:flex;justify-content:space-between;align-items:flex-start;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '#harness-os-chrome .hos-topbar-left{display:flex;flex-direction:column;gap:6px}',
      '#harness-os-chrome .hos-topbar-meta{display:flex;align-items:center;gap:10px}',
      '#harness-os-chrome .hos-topbar-sep{opacity:.45}',
      '#harness-os-chrome .hos-topbar-time{color:var(--dsw-alias-brand-primary)}',
      '#harness-os-chrome .hos-topbar-ticks{display:flex;gap:4px;align-items:flex-end}',
      '#harness-os-chrome .hos-topbar-ticks i{width:1px;height:5px;background:var(--dsw-alias-border-l4,rgba(20,19,15,.24))}',
      '#harness-os-chrome .hos-topbar-right{display:flex;gap:16px}',
      '#harness-os-chrome .hos-topbar-right span::before{content:"+ ";opacity:.55}',

      /* 底部 HUD 带：文本行 + 细进度线（黑线 + 橙色节点），贴内容区下缘 */
      '#harness-os-chrome .hos-bottom{position:absolute;bottom:12px;display:flex;flex-direction:column;gap:10px;pointer-events:none}',
      '#harness-os-chrome .hos-hud{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '#harness-os-chrome .hos-hud-left{display:flex;align-items:center;gap:12px}',
      '#harness-os-chrome .hos-hud-center{text-align:center}',
      '#harness-os-chrome .hos-hud-right{display:flex;align-items:center;justify-content:flex-end;gap:8px}',
      '#harness-os-chrome .hos-hud-accent{color:var(--dsw-alias-brand-primary)}',
      '#harness-os-chrome .hos-sig{display:inline-flex;align-items:flex-end;gap:2px;height:12px}',
      '#harness-os-chrome .hos-sig i{width:2px;background:var(--dsw-alias-brand-primary)}',
      '#harness-os-chrome .hos-sig i:nth-child(1){height:4px;opacity:.45}',
      '#harness-os-chrome .hos-sig i:nth-child(2){height:7px;opacity:.6}',
      '#harness-os-chrome .hos-sig i:nth-child(3){height:9px;opacity:.8}',
      '#harness-os-chrome .hos-sig i:nth-child(4){height:12px}',
      '#harness-os-chrome .hos-bar{position:relative;height:2px;background:var(--dsw-alias-border-l2,rgba(20,19,15,.10))}',
      '#harness-os-chrome .hos-bar b{position:absolute;inset:0 auto 0 0;width:34%;background:var(--dsw-alias-label-primary)}',
      '#harness-os-chrome .hos-bar u{position:absolute;top:50%;left:34%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--dsw-alias-brand-primary)}',

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
      '#harness-os-hero .hos-title-en{display:block;margin-top:12px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      /* 方案 B：标题进驻雷达环正中心（.hos-title--core 覆盖掉外排版的 margin） */
      '#harness-os-hero .hos-title--core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;white-space:nowrap}',
      '#harness-os-hero .hos-dash{display:inline-block;width:18px;height:3px;margin-left:14px;vertical-align:middle;background:var(--dsw-alias-brand-primary)}'
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

    // 偏好缓存：Chrome / Dock / Hero 每次渲染都要读偏好，原先每次都同步
    // 打 localStorage（HANDOFF 3.6）。现在模块级缓存一份，只在写入后失效。
    var prefsCache = null;

    function getPrefs() {
      if (prefsCache === null) prefsCache = readPrefs();
      return prefsCache;
    }

    function writePrefs(prefs) {
      prefsCache = null;
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
        // 样式表体检：元素在而样式缺失 = 全部不可见的头号嫌疑（冷启动竞态）
        var styleEl = document.getElementById(STYLE_ID);
        out.styleElExists = styleEl !== null;
        try { out.styleRules = styleEl && styleEl.sheet ? styleEl.sheet.cssRules.length : -1; } catch (e2) { out.styleRules = -2; }
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
          out.guideRects = [rectOf(root.querySelector('.hos-guide'))];
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

    /* ── 诊断入口（默认完全关闭）────────────────────────────────────────
       发布版不得写任何 localStorage。所有诊断触发收拢到 runDiagnostics：
       先过编译期常量 DEBUG_DIAG，再过运行期调试键（debug==='1'），
       双闸全开才会有写入与定时器。门禁断言：诊断调用不得出现在此链之外。 */
    function diagEnabled() {
      if (!DEBUG_DIAG) return false;
      try { return String(window.localStorage.getItem(DEBUG_KEY)) === '1'; } catch (e) { return false; }
    }

    function runDiagnostics(prefs) {
      if (!diagEnabled()) return;
      try {
        if (typeof setTimeout === 'function') {
          setTimeout(function () { recordDiag({ prefs: readPrefs(), probes: probeOverlay() }); }, 600);
        }
        startBlankCapture(prefs);
      } catch (e) { /* 忽略 */ }
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

    /* ── 锚点 store：**单一** 1200ms 订阅，服务所有消费者 ───────────────────
       Hero 与 Dock 曾经各自 useAnchors()，同时跑两个 1200ms setInterval，
       测的还是同一个 [data-composer-seat]（HANDOFF 3.2）。现在收敛成模块级
       store：有订阅者才运转，字段无变化不广播（避免无意义重渲染）。
       Chrome（辅助线 / 品牌标记对齐）也从这里取数 —— 全页仍然只有一个定时器。 */

    var ANCHOR_EMPTY = { cx: null, left: null, right: null, top: null, bottom: null, vh: 0, vw: 0, blank: false };
    var anchorState = ANCHOR_EMPTY;
    var anchorSubs = [];
    var anchorTimer = null;

    function anchorMeasure() {
      var next = {
        cx: null, left: null, right: null, top: null, bottom: null,
        vh: (typeof window !== 'undefined') ? window.innerHeight : 0,
        vw: (typeof window !== 'undefined') ? window.innerWidth : 0,
        blank: isBlankSession()
      };
      try {
        var seat = document.querySelector('[data-composer-seat]');
        if (seat) {
          var r = seat.getBoundingClientRect();
          // 0×0 说明输入座此刻不在布局里（隐藏 / 过渡中）——按"没测到"处理，
          // 让消费者走各自的失败分支，而不是把辅助线收拢到 x=0。
          if (r.width > 0 || r.height > 0) {
            next.cx = Math.round(r.left + r.width / 2);
            next.left = Math.round(r.left);
            next.right = Math.round(r.right);
            next.top = Math.round(r.top);
            next.bottom = Math.round(r.bottom);
          }
        }
      } catch (e) { /* 保持 null */ }
      var changed = next.cx !== anchorState.cx || next.left !== anchorState.left
        || next.right !== anchorState.right || next.top !== anchorState.top
        || next.bottom !== anchorState.bottom || next.vh !== anchorState.vh
        || next.vw !== anchorState.vw || next.blank !== anchorState.blank;
      if (!changed) return;
      anchorState = next;
      for (var i = anchorSubs.length - 1; i >= 0; i--) {
        try { anchorSubs[i](); } catch (e) { /* 单个订阅者失败不影响其他 */ }
      }
    }

    function anchorEnsure() {
      if (anchorTimer !== null) return;
      anchorMeasure();
      anchorTimer = setInterval(anchorMeasure, 1200);
      window.addEventListener('resize', anchorMeasure);
    }

    function subscribeAnchors(fn) {
      anchorSubs.push(fn);
      anchorEnsure();
      return function () {
        var i = anchorSubs.indexOf(fn);
        if (i >= 0) anchorSubs.splice(i, 1);
        if (anchorSubs.length === 0 && anchorTimer !== null) {
          clearInterval(anchorTimer);
          anchorTimer = null;
          window.removeEventListener('resize', anchorMeasure);
          anchorState = ANCHOR_EMPTY;
        }
      };
    }

    /**
     * 锚点 hook：输入座的落位与空白态判定。
     *
     * **位置实测，不猜中心**：读 `[data-composer-seat]`（DSH 文档化的稳定锚点，
     * 两种状态下都存在）。直接按视口 50% 居中会因为左侧栏的存在而整体偏左
     * —— 这是猜出来的定位必然踩的坑。
     */
    function useAnchors(enabled) {
      if (!React || typeof React.useState !== 'function' || typeof React.useEffect !== 'function') return ANCHOR_EMPTY;
      var pair = React.useState(enabled ? anchorState : ANCHOR_EMPTY);
      var state = pair[0];
      var setState = pair[1];
      React.useEffect(function () {
        if (!enabled) { setState(ANCHOR_EMPTY); return; }
        setState(anchorState);
        return subscribeAnchors(function () { setState(anchorState); });
      }, [enabled]);
      return state;
    }

    /* ── 方案 B：接管宿主空白态标题（总开关 prefs.takeover）────────────────
       约束（HANDOFF 5.1，必须全部成立才动手）：
       1. 失败即无操作 —— 匹配不到或几何不对，什么都不做；
       2. 一个总开关 —— 设置行「接管空白页」一键回到纯加性模式；
       3. 只在空白会话生效；
       4. 指纹集中在此处并标注：**不做精确哈希匹配**（实测 DSH 构建一换哈希就
          全变，_1rdzk_/_3GBCTG/_jhda5_ 那套当天就过期），改用「class 子串族
          （_summaryText → _summary 逐级放宽）+ 结构过滤 + 字号最大者胜」，
          并用几何（必须在输入座上方）兜底。
       匹配不到 = 宿主标题照常显示、我们不加中央标题，绝不留半截样式。 */
    var hiddenTitleRow = null;

    function restoreTitleRow() {
      if (hiddenTitleRow === null) return;
      try { hiddenTitleRow.style.visibility = ''; } catch (e) { /* 节点已随宿主重建 */ }
      hiddenTitleRow = null;
    }

    function hideTitleRow(el) {
      if (hiddenTitleRow === el) return;
      restoreTitleRow();
      try { el.style.visibility = 'hidden'; } catch (e) { return; }
      hiddenTitleRow = el;
    }

    /**
     * 定位宿主欢迎标题行。
     * class 子串族由窄到宽逐级尝试；命中多个取**字号最大**的（标题是该区域
     * 最大的文字）。找到叶子后向上走（最多 4 级）找能同时容纳「预览版」徽标
     * 的那一行作为隐藏目标 —— 徽标按设计稿一并隐藏；文案长度超 60 字的祖先
     * 视为走过头，回退上一级。seatTop 兜底：目标行必须整体在输入座上方。
     */
    function findTitleRow(seatTop) {
      try {
        if (typeof document === 'undefined' || !document.querySelectorAll) return null;
        var selectors = ['span[class*="_summaryText"]', 'span[class*="_summary"]'];
        var hits = [];
        for (var s = 0; s < selectors.length && hits.length === 0; s++) {
          var nodes = document.querySelectorAll(selectors[s]);
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.closest && el.closest('[data-conversation-region="composer"]')) continue;
            var t = String(el.textContent || '').trim();
            if (t.length < 2 || t.length > 30) continue;
            var r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            hits.push(el);
          }
        }
        if (hits.length === 0) return null;
        var best = hits[0];
        var bestSize = -1;
        for (var j = 0; j < hits.length; j++) {
          var fs = parseFloat(getComputedStyle(hits[j]).fontSize) || 0;
          if (fs > bestSize) { bestSize = fs; best = hits[j]; }
        }
        var row = best;
        for (var d = 0; d < 4 && row.parentElement; d++) {
          var prev = row;
          row = row.parentElement;
          var tx = String(row.textContent || '');
          if (tx.indexOf('预览版') >= 0) break;
          if (tx.length > 60) { row = prev; break; }
        }
        var rr = row.getBoundingClientRect();
        if (seatTop !== null && rr.bottom > seatTop + 8) return null;
        return row;
      } catch (e) { return null; }
    }

    /**
     * Hero：雷达环，叠加在空白会话上（默认关闭；开启 takeover 后标题进驻环心）。
     *
     * **刻意不含标题（takeover 关闭时）。** 第一版带了自己那行「探索未至之境」，
     * 结果截图里出现两行一样的字 —— 因为宿主空白态自带的标题本来就是同一句。
     * takeover 开启且指纹匹配成功时，宿主标题行被隐藏，我们的大标题
     * （探索未知之境 + EXPLORE THE UNKNOWN，按需求原文）才进驻环心；
     * 匹配失败 = 宿主标题原样保留、无中央标题（失败即无操作）。
     */
    function Hero() {
      var prefs = getPrefs();
      var wantHero = prefs.hero === true;
      var st = useAnchors(wantHero);
      var takeover = wantHero && prefs.takeover === true;
      var pair = React.useState(false);
      var titleTaken = pair[0];
      var setTitleTaken = pair[1];
      React.useEffect(function () {
        if (!takeover || !st.blank || st.top === null) {
          restoreTitleRow();
          setTitleTaken(false);
          return;
        }
        var row = findTitleRow(st.top);
        if (row) {
          hideTitleRow(row);
          setTitleTaken(true);
        } else {
          restoreTitleRow();
          setTitleTaken(false);
        }
        return function () {
          restoreTitleRow();
          setTitleTaken(false);
        };
      }, [takeover, st.blank, st.top, st.vh]);
      if (!wantHero || !st.blank || st.cx === null || st.top === null) return null;

      // takeover 生效时环心对齐输入座上方空间的正中（设计稿构图）；
      // 否则维持旧锚定：下缘在输入座上缘之上 116px。
      var centered = takeover && titleTaken === true;
      var bottom = centered
        ? st.vh - (st.vh - st.top) / 2 - 150
        : Math.max(0, st.vh - st.top + 116);
      var core = [
        React.createElement('i', { key: 'r1', className: 'hos-ring hos-r1' }),
        React.createElement('i', { key: 'r2', className: 'hos-ring hos-r2' }),
        React.createElement('i', { key: 'r3', className: 'hos-ring hos-r3' }),
        React.createElement('i', { key: 'r4', className: 'hos-ring hos-r4' }),
        React.createElement('i', { key: 'r5', className: 'hos-ring hos-r5' }),
        React.createElement('i', { key: 'cross' }),
        React.createElement('i', { key: 'd1', className: 'hos-dot hos-d1' }),
        React.createElement('i', { key: 'd2', className: 'hos-dot hos-d2' }),
        React.createElement('i', { key: 'd3', className: 'hos-dot hos-d3' })
      ];
      if (centered) {
        core.push(React.createElement('div', { key: 'title', className: 'hos-title hos-title--core' },
          React.createElement('span', { className: 'hos-title-cn' }, '探索未知之境',
            React.createElement('i', { className: 'hos-dash' })),
          React.createElement('span', { className: 'hos-title-en' }, 'EXPLORE THE UNKNOWN')
        ));
      }
      return React.createElement('div', {
        id: 'harness-os-hero',
        style: { left: st.cx + 'px', bottom: Math.max(0, bottom) + 'px' }
      },
        React.createElement('div', { className: 'hos-core' }, core)
      );
    }

    /** 顶部信息条右侧的状态微细节（需求原文 DETAILS 清单的子集，克制使用） */
    var TOPBAR_DETAILS = ['SYSTEM READY', 'CORE ONLINE', 'SESSION ACTIVE', 'WORKSPACE READY'];

    function clockText() {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    /** 橙色时钟：只重渲染自己这一格文本，1s 一次（唯一的秒级定时器）。 */
    function TopClock() {
      var pair = React.useState(clockText());
      var setT = pair[1];
      React.useEffect(function () {
        var timer = setInterval(function () { setT(clockText()); }, 1000);
        return function () { clearInterval(timer); };
      }, []);
      return React.createElement('span', { className: 'hos-topbar-time' }, pair[0]);
    }

    /** 顶部系统信息条：REV / WEB PROFILE / 橙色时钟 + 刻度，右侧状态微细节。 */
    function TopBar(props) {
      var st = props.st;
      // 右侧留出 Electron 窗口控制按钮（最小化/最大化/关闭）的区域，
      // 否则最后一个状态词被压在按钮下面（用户截图证实 WORKSPACE READY 被遮）
      var width = Math.max(200, st.right - st.left - 160);
      var ticks = [];
      for (var i = 0; i < 12; i++) ticks.push(React.createElement('i', { key: i }));
      return React.createElement('div', { className: 'hos-topbar', style: { left: st.left + 'px', width: width + 'px' } },
        React.createElement('div', { className: 'hos-topbar-left' },
          React.createElement('div', { className: 'hos-topbar-meta' },
            React.createElement('span', null, 'REV 0.1.0'),
            React.createElement('span', { className: 'hos-topbar-sep' }, '·'),
            React.createElement('span', null, 'WEB PROFILE'),
            React.createElement('span', { className: 'hos-topbar-sep' }, '·'),
            React.createElement(TopClock)
          ),
          React.createElement('div', { className: 'hos-topbar-ticks' }, ticks)
        ),
        React.createElement('div', { className: 'hos-topbar-right' },
          TOPBAR_DETAILS.map(function (t) { return React.createElement('span', { key: t }, t); })
        )
      );
    }

    /** 底部 HUD 带：信号柱 + [ 01 / 06 ] HOME ｜ 等待用户输入 ｜ POWERED BY DEEPSEEK，下接细进度线。 */
    function BottomBand(props) {
      var st = props.st;
      return React.createElement('div', { className: 'hos-bottom', style: { left: st.left + 'px', width: (st.right - st.left) + 'px' } },
        React.createElement('div', { className: 'hos-hud' },
          React.createElement('span', { className: 'hos-hud-left' },
            React.createElement('span', { className: 'hos-sig' },
              React.createElement('i'), React.createElement('i'), React.createElement('i'), React.createElement('i')
            ),
            React.createElement('span', null, '[ 01 / 06 ] HOME')
          ),
          React.createElement('span', { className: 'hos-hud-center' }, '等待用户输入… / AWAITING USER INPUT'),
          React.createElement('span', { className: 'hos-hud-right' },
            React.createElement('span', { className: 'hos-hud-accent' }, 'POWERED BY DEEPSEEK'),
            React.createElement('span', { className: 'hos-brand-mark' })
          )
        ),
        React.createElement('div', { className: 'hos-bar' },
          React.createElement('b'), React.createElement('u')
        )
      );
    }

    function Chrome() {
      var prefs = getPrefs();
      var st = useAnchors(true);
      if (React && typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(0);
        var setV = pair[1];
        React.useEffect(function () {
          return subscribe(function () { setV(function (n) { return n + 1; }); });
        }, []);
      }

      // 输入座实测到位 + 空白会话：文字类装饰（顶栏/胶囊/底带/Hero）的共同前提。
      // 有内容的会话里这些区域被真实内容占用，一概不画（不遮挡）。
      var blank = st.blank === true && st.left !== null && st.cx !== null;
      var hudOn = prefs.hud === true && blank;

      var kids = [];
      if (prefs.corners) {
        kids.push(React.createElement('i', { key: 'tl', className: 'hos-corner hos-tl' }));
        kids.push(React.createElement('i', { key: 'tr', className: 'hos-corner hos-tr' }));
        kids.push(React.createElement('i', { key: 'bl', className: 'hos-corner hos-bl' }));
        kids.push(React.createElement('i', { key: 'br', className: 'hos-corner hos-br' }));
      }
      if (prefs.guides) {
        // 辅助线对齐输入座的**实测**左右边缘 —— 设计稿里它们本就是夹着输入区
        // 两侧的结构线；写死的 25%/75% 不对应任何真实列边界。
        // 测不到输入座就不画（失败即无操作），绝不回落到拍脑袋的位置。
        if (st.left !== null) kids.push(React.createElement('i', { key: 'g1', className: 'hos-guide', style: { left: st.left + 'px' } }));
        if (st.right !== null) kids.push(React.createElement('i', { key: 'g2', className: 'hos-guide', style: { left: st.right + 'px' } }));
      }
      if (prefs.edge) {
        // 底边结构线收进内容区（与设计稿的进度线同一条：黑线 + 橙色节点）；
        // 测不到输入座时回落为整条视口宽。
        var edgeStyle = st.left !== null && st.vw
          ? { left: st.left + 'px', width: (st.right - st.left) + 'px' }
          : null;
        kids.push(React.createElement('i', { key: 'edge', className: 'hos-edge', style: edgeStyle },
          React.createElement('u', { className: 'hos-edge-node' })));
      }
      if (prefs.brand) {
        // 品牌标记挂内容区左下角：左缘取输入座左缘内缩 16px，与四角角标同一套
        // 缩进语言。右下角旧位实测被 dsh-whale-widget 完全遮住（见 hos-brand 注）。
        // 底部 HUD 带可见时让位（左下角是 [ 01 / 06 ] HOME）；HUD 只在空白会话
        // 出现，因此有内容的会话里品牌标记照常显示。
        if (st.left !== null && !hudOn) {
          kids.push(React.createElement('span', { key: 'brand', className: 'hos-brand', style: { left: (st.left + 16) + 'px' } },
            'HARNESSS OS',
            React.createElement('i', { className: 'hos-brand-mark' })
          ));
        }
      }
      if (prefs.topbar === true && blank) kids.push(React.createElement(TopBar, { key: 'topbar', st: st }));
      if (prefs.pills === true && blank) kids.push(React.createElement(Dock, { key: 'dock' }));
      if (hudOn) kids.push(React.createElement(BottomBand, { key: 'bottom', st: st }));
      if (prefs.hero === true && blank) kids.push(React.createElement(Hero, { key: 'hero' }));
      return React.createElement('div', { id: 'harness-os-chrome' }, kids);
    }

    /**
     * Dock：快捷操作胶囊排，锚在输入卡下方。
     *
     * **只在空白会话显示。** 有内容的会话里输入卡下方没有任何空闲区域
     * （实测输入座一直顶到视口底部），任何悬浮元素都会盖住真实消息。
     * HUD/进度线不在这里 —— 设计稿里它们属于内容区最底部，由 BottomBand 承载。
     * 胶囊按设计稿补齐为 5 个，「文件上传」为激活态（橙色，同设计稿）。
     */
    function Dock() {
      var prefs = getPrefs();
      var on = prefs.pills === true;
      var st = useAnchors(on);
      if (React && typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(0);
        var setV = pair[1];
        React.useEffect(function () {
          return subscribe(function () { setV(function (n) { return n + 1; }); });
        }, []);
      }
      if (!on || !st.blank || st.cx === null || st.bottom === null) return null;

      return React.createElement('div', {
        id: 'harness-os-dock',
        // 输入座在卡片下方还带一段内距，减掉 28px 让胶囊贴回卡片下缘附近
        style: { left: st.cx + 'px', top: (st.bottom - 28) + 'px' }
      },
        React.createElement('div', { className: 'hos-pills' },
          React.createElement('span', { className: 'hos-pill hos-pill--on' }, React.createElement('i'), '文件上传'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '知识库'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '生成图像'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '联网搜索'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), 'Agent')
        )
      );
    }

    function apply(ctx) {
      installStyle();

      var prefs = getPrefs();
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

      /* 设置行：id 与宿主自带条目区分开（order 22 接在主题行之后）。
         控件形态照抄宿主 settings 页的官方参数（从产物 CSS 提取）：
         行 = 左侧标题/描述两列 + 右侧控件；布尔项用 36×20 胶囊 Switch
         （16px 圆形 thumb，aria-checked 驱动配色与位移）；动作按钮用
         selector 形态（36px 高、bg-module-platform、radius-md）。
         这些组件在宿主包内部拿不到本体，因此按实测参数用内联样式复刻，
         不引入任何 CSS 规则（也就不触碰作用域白名单）。 */
      var I18N = {
        zh: {
          title: 'HARNESSS OS 界面',
          corners: '四角定位角标', cornersDesc: '视口四角的 L 型制图标记',
          guides: '制图辅助线', guidesDesc: '对齐输入区左右边缘的垂直辅助线',
          edge: '底边线', edgeDesc: '内容区底边的结构线与橙色活动节点',
          brand: '品牌标记', brandDesc: '内容区左下角的 HARNESSS OS 字标（HUD 带可见时让位）',
          pills: '快捷操作', pillsDesc: '输入区下方的胶囊按钮（仅空白会话）',
          hud: 'HUD 文本带', hudDesc: '内容区底部的状态带与进度线（仅空白会话）',
          topbar: '系统信息条', topbarDesc: '顶部的 REV / PROFILE / 时钟与状态微细节（仅空白会话）',
          hero: 'Hero 雷达环', heroDesc: '输入区上方的同心圆弧（仅空白会话）',
          takeover: '接管空白页', takeoverDesc: '隐藏宿主小标题，把大标题放进雷达环中心（仅空白会话；DSH 升级可能自动失效）',
          preview: '打开设计预览',
          hint: '全部为加性叠加：帧层与快捷操作/HUD 均为点击穿透浮层，不替换宿主外壳、不改变宿主布局。颜色跟随当前主题。'
        },
        en: {
          title: 'HARNESSS OS shell',
          corners: 'Corner marks', cornersDesc: 'L-shaped drafting marks at the four corners',
          guides: 'Drafting guides', guidesDesc: 'Vertical guides aligned to the composer edges',
          edge: 'Edge line', edgeDesc: 'Baseline structure line with the active node',
          brand: 'Brand mark', brandDesc: 'HARNESSS OS wordmark at the lower-left of the content area',
          pills: 'Quick actions', pillsDesc: 'Quick-action pills below the composer (blank sessions only)',
          hud: 'HUD text strip', hudDesc: 'Status strip and progress line at the content baseline (blank sessions only)',
          topbar: 'System info bar', topbarDesc: 'Top REV / PROFILE / clock and status micro-details (blank sessions only)',
          hero: 'Hero rings', heroDesc: 'Concentric arcs above the composer (blank sessions only)',
          takeover: 'Blank-state takeover', takeoverDesc: 'Hide the host caption and place the display title inside the rings (blank sessions only; may stop applying after DSH updates)',
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
            var cur = getPrefs();
            var patch = function (key) {
              var next = readPrefs();
              next[key] = cur[key] === false;
              writePrefs(next);
              bump();
              rerender();
            };
            var openPreview = function () {
              try {
                var url = new URL(PREVIEW_URL, (typeof document !== 'undefined' && document.baseURI) || undefined).href;
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch (e) { /* 打不开就算了 */ }
            };

            /* 宿主 PreferenceRow / Switch 的实测参数（见 apply 顶部注释） */
            var box = { display: 'flex', flexDirection: 'column', padding: '12px 0' };
            var head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' };
            var groupTitle = { color: 'var(--dsw-alias-label-primary)', fontSize: '14px', fontWeight: 600, lineHeight: '22px' };
            var selector = {
              borderRadius: 'var(--dsw-radius-md)', background: 'var(--dsw-alias-bg-module-platform)',
              height: '36px', font: 'inherit', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
              border: 'none', alignItems: 'center', gap: '12px', padding: '0 14px',
              fontSize: '14px', lineHeight: '22px', display: 'inline-flex'
            };
            var row = {
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0',
              borderBottom: '.5px solid var(--dsw-alias-border-l2)'
            };
            var rowText = { display: 'flex', flexDirection: 'column', flex: 1, gap: '2px', minWidth: 0, paddingRight: '48px' };
            var rowTitle = { color: 'var(--dsw-alias-label-primary)', fontSize: '14px', fontWeight: 400, lineHeight: '22px' };
            var rowDesc = { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', fontWeight: 400, lineHeight: '18px' };
            var switchStyle = function (on) {
              return {
                boxSizing: 'border-box', position: 'relative', flex: '0 0 auto',
                width: '36px', height: '20px', padding: '2px', border: 0, borderRadius: '999px',
                background: on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l3)',
                cursor: 'pointer'
              };
            };
            var thumbStyle = function (on) {
              return {
                display: 'block', width: '16px', height: '16px', borderRadius: '50%',
                background: on ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-switch-thumb)',
                transform: on ? 'translate(16px)' : 'none',
                transition: 'transform .12s ease'
              };
            };
            return React.createElement('div', { style: box, 'data-hos': 'ui-settings-row' },
              React.createElement('div', { style: head },
                React.createElement('strong', { style: groupTitle }, translate('title')),
                React.createElement('button', { type: 'button', style: selector, onClick: openPreview },
                  translate('preview'))
              ),
              ['corners', 'guides', 'edge', 'brand', 'pills', 'hud', 'topbar', 'hero', 'takeover'].map(function (k) {
                var on = cur[k] !== false;
                return React.createElement('div', { key: k, style: row },
                  React.createElement('div', { style: rowText },
                    React.createElement('div', { style: rowTitle }, translate(k)),
                    React.createElement('div', { style: rowDesc }, translate(k + 'Desc'))
                  ),
                  React.createElement('button', {
                    type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': translate(k),
                    style: switchStyle(on), onClick: function () { patch(k); }
                  }, React.createElement('span', { style: thumbStyle(on) }))
                );
              }),
              React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', lineHeight: '18px', padding: '8px 0 0' } },
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

      /* 诊断：默认零写入、零定时器（runDiagnostics 的双闸见其注释）。 */
      runDiagnostics(prefs);

      ctx.effect(function () {
        return function () {
          for (var i = 0; i < disposers.length; i++) {
            try { disposers[i](); } catch (e) { /* 忽略 */ }
          }
          restoreTitleRow(); // 方案 B：卸载时恢复被隐藏的宿主标题行
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
