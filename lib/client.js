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

      /* 四角 L 型定位角标 */
      '#harness-os-chrome .hos-corner{position:absolute;width:14px;height:14px}',
      '#harness-os-chrome .hos-corner::before,',
      '#harness-os-chrome .hos-corner::after{content:"";position:absolute;background:var(--dsw-alias-border-l4,rgba(20,19,15,.24))}',
      '#harness-os-chrome .hos-corner::before{width:14px;height:1px}',
      '#harness-os-chrome .hos-corner::after{width:1px;height:14px}',
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

      /* 制图辅助线 */
      '#harness-os-chrome .hos-guide{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l1,rgba(20,19,15,.06))}',

      /* 底边线 + 橙色活动节点 */
      '#harness-os-chrome .hos-edge{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--dsw-alias-label-primary,#14130f);opacity:.85}',
      '#harness-os-chrome .hos-edge-node{position:absolute;bottom:-2px;left:32%;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary,#ff7500)}',

      /* 右下品牌标记 */
      '#harness-os-chrome .hos-brand{position:absolute;right:16px;bottom:9px;font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b8780)}',
      '#harness-os-chrome .hos-brand-mark{display:inline-block;width:22px;height:4px;margin-left:8px;vertical-align:middle;background:var(--dsw-alias-label-primary,#14130f)}',

      /* HUD 文本带**不再放在帧层**：composer.dock 的官方定义是
         "Ambient entries below the composer card"，在正常文档流里位于输入卡下方，
         因此不会覆盖任何内容 —— 这才是设计稿里 HUD 与快捷操作的正确位置。 */
      '#harness-os-dock{display:flex;flex-direction:column;gap:10px;padding:12px 2px 4px}',
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
      '#harness-os-hero{position:fixed;transform:translate(-50%,-50%);pointer-events:none;text-align:center;z-index:0}',
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
        window.localStorage.setItem(DIAG_KEY, JSON.stringify({
          slot: 'shell.overlay',
          id: SOURCE,
          prefs: info.prefs,
          overlayProbes: info.probes,
          at: new Date().toISOString()
        }));
      } catch (e) { /* 忽略 */ }
    }

    /**
     * 探针：装饰层是**读回**验证的。
     * 注意 DSH 的令牌不在 <html> 上（在 body/#root），所以这里查的是
     * 我们自己的装饰节点是否存在、以及它算出来的描边色 —— 用来确认
     * "挂上了" 与 "确实吃到了当前主题令牌"。
     */
    function probeOverlay() {
      var out = {};
      try {
        if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return out;
        var root = document.getElementById('harness-os-chrome');
        out.mounted = root !== null;
        if (root !== null) {
          var corner = root.querySelector('.hos-corner');
          out.corners = root.querySelectorAll('.hos-corner').length;
          if (corner) {
            var cs = getComputedStyle(corner, '::before');
            out.cornerPaint = String(cs && cs.backgroundColor || '').trim();
          }
          out.guides = root.querySelectorAll('.hos-guide').length;
        }
      } catch (e) { /* 探针失败留空 */ }
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
    function useHeroState(enabled) {
      var pair = React.useState({ pos: null, blank: false });
      var state = pair[0];
      var setState = pair[1];
      React.useEffect(function () {
        if (!enabled) { setState({ pos: null, blank: false }); return; }
        var measure = function () {
          var blank = isBlankSession();
          var pos = null;
          try {
            var seat = document.querySelector('[data-composer-seat]');
            if (seat) {
              var r = seat.getBoundingClientRect();
              pos = { left: Math.round(r.left + r.width / 2), top: Math.round(r.top - 186) };
            }
          } catch (e) { pos = null; }
          setState(function (prev) {
            // 只在真正变化时更新，避免每秒无意义重渲染
            if (prev.blank === blank && prev.pos && pos
              && prev.pos.left === pos.left && prev.pos.top === pos.top) return prev;
            if (prev.blank === blank && prev.pos === null && pos === null) return prev;
            return { pos: pos, blank: blank };
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
     * Hero：雷达环 + 主标，叠加在空白会话上（**默认关闭**）。
     *
     * 为什么是叠加而不是替换：宿主没有暴露 Hero 视觉容器的加性槽位，
     * 唯一相关的 `conversation.hero.workspace` 是 single 且会顶掉工作区选择器。
     * 叠加层是点击穿透的，因此只影响观感、不影响操作。
     */
    function Hero() {
      var prefs = readPrefs();
      var st = useHeroState(prefs.hero === true);
      if (prefs.hero !== true || !st.blank || !st.pos) return null;
      return React.createElement('div', {
        id: 'harness-os-hero',
        style: { left: st.pos.left + 'px', top: st.pos.top + 'px' }
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
        ),
        React.createElement('div', { className: 'hos-title' },
          React.createElement('span', { className: 'hos-title-cn' }, '探索未知之境'),
          React.createElement('span', { className: 'hos-title-en' }, 'EXPLORE THE UNKNOWN')
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
      if (prefs.hero === true) kids.push(React.createElement(Hero, { key: 'hero' }));
      return React.createElement('div', { id: 'harness-os-chrome' }, kids);
    }

    /**
     * Dock：挂在 conversation.composer.dock 上的加性条目。
     *
     * 该槽位的官方定义是 "Ambient entries **below the composer card**" ——
     * 处于正常文档流、位于输入卡下方，所以这里放快捷操作与 HUD 文本带
     * **不会覆盖任何宿主内容**（这正是它比帧层更适合承载 HUD 的原因）。
     */
    function Dock() {
      var prefs = readPrefs();
      if (React && typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(0);
        var setV = pair[1];
        React.useEffect(function () {
          return subscribe(function () { setV(function (n) { return n + 1; }); });
        }, []);
      }
      var kids = [];

      if (prefs.pills) {
        kids.push(React.createElement('div', { key: 'pills', className: 'hos-pills' },
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '文件上传'),
          React.createElement('span', { className: 'hos-pill' }, React.createElement('i'), '知识库'),
          React.createElement('span', { className: 'hos-pill hos-pill--on' }, React.createElement('i'), '生成图像')
        ));
      }

      if (prefs.hud) {
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
      return React.createElement('div', { id: 'harness-os-dock' }, kids);
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

      /* 快捷操作 + HUD 文本带：composer.dock 也是加性席位（replaceRisk none），
         且位于输入卡下方的正常文档流里，因此不覆盖宿主内容。 */
      if (React && slots && typeof slots.register === 'function') {
        try {
          disposers.push(slots.register(
            { name: 'conversation.composer.dock', id: SOURCE, order: 10 },
            function () { return React.createElement(Dock); }
          ));
        } catch (e) { /* 席位不可用：仅失去快捷操作与 HUD */ }
      }

      /* 设置行：id 与宿主自带条目区分开（order 22 接在主题行之后）*/
      var I18N = {
        zh: {
          title: 'HARNESS OS 界面',
          corners: '四角定位角标', guides: '制图辅助线', edge: '底边线',
          brand: '品牌标记', pills: '快捷操作', hud: 'HUD 文本带', hero: 'Hero 雷达环',
          preview: '打开设计预览',
          hint: '全部为加性叠加：帧层点击穿透，快捷操作与 HUD 位于输入卡下方的正常文档流；不替换宿主外壳。颜色跟随当前主题。'
        },
        en: {
          title: 'HARNESS OS shell',
          corners: 'Corner marks', guides: 'Drafting guides', edge: 'Edge line',
          brand: 'Brand mark', pills: 'Quick actions', hud: 'HUD text strip', hero: 'Hero rings',
          preview: 'Open design preview',
          hint: 'Everything is additive: the frame layer is click-through, and quick actions plus the HUD sit below the composer card in normal flow. The host shell is never replaced. Colors follow the active theme.'
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

      /* 诊断：等待装饰真正落到 DOM 后读回一次 */
      try {
        if (typeof setTimeout === 'function') {
          setTimeout(function () { recordDiag({ prefs: readPrefs(), probes: probeOverlay() }); }, 600);
        }
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
