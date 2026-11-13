// dsh-weather-badge — browser half: weather embedded in the Harness top bar.
//
// Hand-written in the lazy-CJS bundle protocol (window.__ModuleLoader__.load
// with a factory returning cordis-plugin exports), so no build step and no
// imports from dsh client packages — the same zero-dependency stance as the
// host half. React arrives through the platform module table; services through
// the cordis service inject.
//
// Surfaces:
//   1. A weather badge embedded in the conversation header's leading seat —
//      the top bar of the interface, visible as soon as the app opens, no
//      click needed. Clicking it toggles the full weather panel in the main
//      area.
//   2. A left-sidebar panel row + main-area panel (the plugin-market seats).
//   3. A right-sidebar tab with a guide entry.
// Data comes straight from the free Open-Meteo APIs (CORS enabled, no key);
// rough IP location tries ipwho.is first, then ipapi.co; the chosen city
// persists in localStorage. The badge and the cards share one forecast cache
// and follow city changes through a window event.
window.__ModuleLoader__.load({
  id: 'dsh-weather-badge',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var react = require('react')
    var h = react.createElement

    // ---------------------------------------------------------------------------
    // Styles: one <style> tag, injected once, prefixed class names only.
    // ---------------------------------------------------------------------------
    var CSS_ID = 'dsh-weather-badge/client.css'
    var CSS = [
      '.dshw-root{display:flex;flex-direction:column;gap:12px;padding:14px 16px;height:100%;overflow-y:auto;box-sizing:border-box;font-size:14px;color:inherit}',
      '.dshw-root>*{flex:none}',
      '.dshw-page{max-width:560px;margin:0 auto;padding:20px 28px 24px;height:100%;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px}',
      // Shared glass controls.
      '.dshw-back{align-self:flex-end;border:none;background:rgba(127,127,127,.1);color:inherit;border-radius:999px;padding:5px 14px;font-size:12px;cursor:pointer;opacity:.75;box-shadow:inset 0 0 0 1px rgba(127,127,127,.22);transition:opacity .15s,background .15s}',
      '.dshw-back:hover{opacity:1;background:rgba(127,127,127,.18)}',
      '.dshw-search{display:flex;gap:8px}',
      '.dshw-search input{flex:1;min-width:0;border:none;background:rgba(127,127,127,.1);color:inherit;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;box-shadow:inset 0 0 0 1px rgba(127,127,127,.22);transition:box-shadow .15s,background .15s}',
      '.dshw-search input:focus{background:rgba(127,127,127,.16);box-shadow:inset 0 0 0 1px rgba(127,127,127,.45)}',
      '.dshw-search input::placeholder{color:inherit;opacity:.4}',
      '.dshw-searchbtn{border:none;background:rgba(127,127,127,.1);color:inherit;border-radius:10px;padding:8px 14px;font-size:13px;cursor:pointer;flex:none;box-shadow:inset 0 0 0 1px rgba(127,127,127,.22);transition:background .15s}',
      '.dshw-searchbtn:hover{background:rgba(127,127,127,.18)}',
      '.dshw-searchbtn:disabled{opacity:.4;cursor:default}',
      '.dshw-results{display:flex;flex-direction:column;border-radius:10px;overflow:hidden;background:rgba(127,127,127,.08);box-shadow:inset 0 0 0 1px rgba(127,127,127,.2)}',
      '.dshw-result{text-align:left;padding:8px 12px;background:transparent;border:none;border-bottom:1px solid rgba(127,127,127,.12);color:inherit;cursor:pointer;font-size:13px;width:100%;box-sizing:border-box}',
      '.dshw-result:last-child{border-bottom:none}',
      '.dshw-result:hover{background:rgba(127,127,127,.14)}',
      '.dshw-retry{border:none;background:rgba(127,127,127,.1);color:inherit;border-radius:999px;padding:5px 14px;font-size:12px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(127,127,127,.22)}',
      '.dshw-retry:hover{background:rgba(127,127,127,.18)}',
      '.dshw-iconbtn{border:none;background:transparent;color:inherit;cursor:pointer;padding:4px 6px;border-radius:8px;opacity:.6;font-size:14px;line-height:1;flex:none;transition:opacity .15s,background .15s}',
      '.dshw-iconbtn:hover{opacity:1;background:rgba(127,127,127,.15)}',
      '.dshw-iconbtn:disabled{opacity:.3;cursor:default;background:transparent}',
      // Account-row badge: flat and transparent — it dissolves into the harness UI.
      // Sits in the account row itself: allowed to shrink (flex:0 1 auto) so a
      // narrow rail compresses the chip instead of pushing it over the account.
      '.dshw-chip-host{display:inline-flex;align-items:center;flex:none;height:48px}',
      // 账号下方的信息块：整行宽、居中三行文字。
      '.dshw-info-host{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;padding:0 8px 4px;box-sizing:border-box;--dshw-font:inherit}',
      '.dshw-info{display:flex;flex-direction:row;align-items:center;justify-content:center;flex-wrap:nowrap;gap:6px;width:100%;min-width:0;border:none;color:inherit;font:inherit;font-family:var(--dshw-font,inherit);text-align:center;cursor:pointer;padding:2px 6px;border-radius:8px;background:transparent;transition:background .16s;white-space:nowrap;overflow:hidden}',
      '.dshw-topbar{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;flex:none;height:48px;padding:0;box-sizing:border-box;border:none;color:inherit;font:inherit;cursor:pointer;border-radius:8px;background:transparent;transition:background .16s;--dshw-font:inherit}',
      '.dshw-topbar:hover{background:rgba(127,127,127,.12)}',
      '.dshw-info:hover{background:rgba(127,127,127,.12)}',
      '.dshw-t-sun{--dshw-accent:255,176,64}',
      '.dshw-t-night{--dshw-accent:130,140,255}',
      '.dshw-t-cloud{--dshw-accent:150,170,200}',
      '.dshw-t-rain{--dshw-accent:86,148,255}',
      '.dshw-t-snow{--dshw-accent:150,205,255}',
      '.dshw-t-storm{--dshw-accent:178,132,255}',
      '.dshw-t-fog{--dshw-accent:168,180,195}',
      '.dshw-clock{width:48px;height:48px;flex:none;display:block;contain:layout size}',
      '.dshw-clock svg{display:block;width:100%;height:100%}',
      '.dshw-wxdial{display:block;flex:none;contain:layout size paint}',
      '.dshw-wxdial-temp{fill:currentColor;font-family:var(--dshw-font,Georgia,serif);font-variant-numeric:lining-nums tabular-nums;opacity:.9}',
      '.dshw-wxdial-hum{fill:#1f6fae;font-family:var(--dshw-font,Georgia,serif);font-variant-numeric:lining-nums tabular-nums}',
      '.dshw-clock text{font-family:var(--dshw-font,Georgia,serif);font-variant-numeric:lining-nums tabular-nums;font-feature-settings:"lnum" 1,"tnum" 1}',
      '.dshw-numeral{opacity:.94}',
      '.dshw-numeral-major{opacity:1}',
      '.dshw-hand-hour,.dshw-hand-minute,.dshw-hand-second,.dshw-hand-dot{pointer-events:none}',
      '.dshw-meta{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;flex:0 1 auto;min-width:0;max-width:100%;overflow:hidden;white-space:nowrap;font-size:11px;line-height:1.2;font-variant-numeric:tabular-nums;font-family:var(--dshw-font,inherit);text-align:center}',
      '.dshw-line{display:flex;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:400;line-height:1.2}',
      '.dshw-emoji{line-height:1}',
      '.dshw-cond{display:inline-block;flex:none;max-width:3.3em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshw-sub{display:inline-flex;align-items:center;justify-content:center;gap:3px;font-size:13px;font-weight:400;opacity:.82;text-shadow:0 0 .6px currentColor}',
      '.dshw-sep{opacity:.35;font-size:13px}',
      // Dial theme picker, panel only: five silhouettes as swatches.
      '.dshw-dial-row{display:flex;align-items:center;gap:10px;padding:1px 2px 0}',
      '.dshw-dial-label{font-size:11px;opacity:.55;letter-spacing:.4px;flex:none}',
      '.dshw-dial-swatches{display:flex;gap:8px;flex-wrap:wrap}',
      '.dshw-dial-swatch{display:block;width:30px;height:30px;padding:0;border:none;border-radius:999px;background:transparent;color:inherit;cursor:pointer;opacity:.62;transition:opacity .15s}',
      '.dshw-dial-swatch:hover{opacity:.9}',
      '.dshw-dial-swatch[data-active="1"]{opacity:1;box-shadow:inset 0 0 0 1.5px currentColor}',
      '.dshw-dial-swatch svg{display:block;width:100%;height:100%}',
      '.dshw-font{font-size:12px;line-height:1;padding:5px 10px;border-radius:999px;border:none;background:rgba(127,127,127,.1);color:inherit;cursor:pointer;opacity:.7;transition:opacity .15s,background .15s}',
      '.dshw-font:hover{opacity:1}',
      '.dshw-font[data-active="1"]{opacity:1;background:rgba(127,127,127,.22);box-shadow:inset 0 0 0 1px rgba(127,127,127,.3)}',
      // Panel header.
      '.dshw-head{display:flex;align-items:center;gap:6px}',
      '.dshw-city{font-size:16px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshw-cityhint{font-size:11px;opacity:.5;font-weight:400;margin-left:4px}',
      // Hero card: weather-reactive gradient + animated SVG art.
      '.dshw-hero{position:relative;overflow:hidden;border-radius:18px;padding:18px 20px 16px;color:#fff;background:var(--dshw-hero,linear-gradient(150deg,#2f80ed,#7fd4ff));box-shadow:0 10px 30px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.2)}',
      '.dshw-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(130% 100% at 88% -12%,rgba(255,255,255,.38),transparent 55%),radial-gradient(100% 80% at -8% 112%,rgba(0,0,0,.22),transparent 60%);pointer-events:none}',
      '.dshw-hero>*{position:relative;z-index:1}',
      '.dshw-hero-top{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.dshw-hero-temp{font-size:54px;font-weight:200;line-height:1.05;letter-spacing:-2px;font-variant-numeric:tabular-nums}',
      '.dshw-hero-desc{font-size:14px;opacity:.92;margin-top:3px}',
      '.dshw-hero-art{flex:none;width:72px;height:72px}',
      '.dshw-hero-art svg{display:block;width:100%;height:100%}',
      '.dshw-hero-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}',
      '.dshw-chip{font-size:11.5px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);white-space:nowrap}',
      // Hourly curve.
      '.dshw-chart{border-radius:14px;padding:12px 14px 8px;background:rgba(127,127,127,.07);box-shadow:inset 0 0 0 1px rgba(127,127,127,.16)}',
      '.dshw-chart-title{font-size:11px;opacity:.55;margin-bottom:4px;letter-spacing:.5px}',
      '.dshw-chart svg{display:block;width:100%;height:64px}',
      '.dshw-chart-labels{display:flex;justify-content:space-between;margin-top:2px}',
      '.dshw-chart-label{display:flex;flex-direction:column;align-items:center;gap:1px}',
      '.dshw-chart-hour{font-size:10px;opacity:.45;font-variant-numeric:tabular-nums}',
      '.dshw-chart-temp{font-size:11px;opacity:.8;font-variant-numeric:tabular-nums}',
      // Daily rows with min–max range bars.
      '.dshw-days{display:flex;flex-direction:column;gap:2px}',
      '.dshw-day{display:grid;grid-template-columns:64px 24px minmax(0,1fr) 72px 64px;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;font-size:13px;transition:background .15s}',
      '.dshw-day:hover{background:rgba(127,127,127,.08)}',
      '.dshw-day-name{opacity:.85;white-space:nowrap}',
      '.dshw-day-emoji{font-size:15px;line-height:1;text-align:center}',
      '.dshw-day-text{opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshw-range{position:relative;display:block;height:5px;border-radius:3px;background:rgba(127,127,127,.2);overflow:hidden}',
      '.dshw-range-fill{position:absolute;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,#4facfe,#f9b64a)}',
      '.dshw-day-temp{font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.9;font-size:12.5px;text-align:right}',
      // States & footer.
      '.dshw-status{opacity:.6;font-size:13px;padding:8px 0}',
      '.dshw-error{font-size:13px;padding:8px 0;display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
      '.dshw-errortext{color:#e05555;word-break:break-word}',
      '.dshw-foot{font-size:11px;opacity:.45;margin-top:auto;padding-top:8px}',
      '.dshw-banner{font-size:12px;opacity:.65}',
      // Motion.
      '@keyframes dshw-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '.dshw-rise{animation:dshw-rise .5s cubic-bezier(.2,.7,.3,1) both}',
      '@keyframes dshw-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
      '@keyframes dshw-spin{to{transform:rotate(360deg)}}',
      '@keyframes dshw-fall{0%{transform:translateY(-2px);opacity:0}25%{opacity:1}100%{transform:translateY(9px);opacity:0}}',
      '@keyframes dshw-flash{0%,55%,100%{opacity:.25}60%,70%{opacity:1}}',
      '@keyframes dshw-twinkle{0%,100%{opacity:.25}50%{opacity:1}}',
      '.dshw-art-sun{animation:dshw-spin 26s linear infinite;transform-origin:32px 30px}',
      '.dshw-art-cloud{animation:dshw-bob 4.5s ease-in-out infinite}',
      '.dshw-art-drop{animation:dshw-fall 1.5s linear infinite}',
      '.dshw-art-flake{animation:dshw-fall 2.6s linear infinite}',
      '.dshw-art-bolt{animation:dshw-flash 2.6s ease-in-out infinite}',
      '.dshw-art-star{animation:dshw-twinkle 2.4s ease-in-out infinite}',
    ].join('\n')
    if (typeof document !== 'undefined') {
      // Refresh in place: a hot reload keeps the old tag, and stale rules must
      // not survive a stylesheet change.
      var styleTag = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]')
      if (styleTag === null) {
        styleTag = document.createElement('style')
        styleTag.dataset.plugin = 'dsh-weather-badge'
        styleTag.dataset.pluginCss = CSS_ID
        document.head.appendChild(styleTag)
      }
      if (styleTag.textContent !== CSS) styleTag.textContent = CSS
    }

    // ---------------------------------------------------------------------------
    // WMO weather interpretation codes.
    // ---------------------------------------------------------------------------
    var WEATHER_TEXT = {
      0: '晴', 1: '基本晴', 2: '多云', 3: '阴',
      45: '雾', 48: '雾凇',
      51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 56: '冻毛毛雨', 57: '强冻毛毛雨',
      61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '强冻雨',
      71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
      80: '小阵雨', 81: '阵雨', 82: '强阵雨', 85: '小阵雪', 86: '阵雪',
      95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷阵雨伴冰雹',
    }
    var WEATHER_EMOJI = {
      0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
      45: '🌫️', 48: '🌫️',
      51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
      61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
      71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
      80: '🌦️', 81: '🌦️', 82: '⛈️', 85: '🌨️', 86: '🌨️',
      95: '⛈️', 96: '⛈️', 99: '⛈️',
    }
    function codeText(code) {
      var text = WEATHER_TEXT[code]
      return text === undefined ? '—' : text
    }
    function codeEmoji(code) {
      return WEATHER_EMOJI[code] || '🌡️'
    }

    // ---------------------------------------------------------------------------
    // Look & feel: weather-reactive themes plus an animated SVG art icon for
    // the hero card (compact surfaces keep the emoji set).
    // ---------------------------------------------------------------------------
    var HERO_THEMES = {
      clear: 'linear-gradient(150deg,#2f80ed 0%,#7fd4ff 100%)',
      night: 'linear-gradient(150deg,#141e3c 0%,#2b3a67 100%)',
      partly: 'linear-gradient(150deg,#4a7fd4 0%,#8ec9f0 100%)',
      cloud: 'linear-gradient(150deg,#54718f 0%,#8fb0c9 100%)',
      fog: 'linear-gradient(150deg,#6e8296 0%,#a3b4c4 100%)',
      rain: 'linear-gradient(150deg,#2c4a7c 0%,#4f7ab8 100%)',
      snow: 'linear-gradient(150deg,#5d8fb8 0%,#a9cbe8 100%)',
      thunder: 'linear-gradient(150deg,#2b2d54 0%,#5c4d8f 100%)',
    }
    var BADGE_KIND = {
      clear: 'sun', night: 'night', partly: 'sun', cloud: 'cloud',
      fog: 'fog', rain: 'rain', snow: 'snow', thunder: 'storm',
    }
    function artKindOf(code, isDay) {
      if (code === 0 || code === 1) return isDay ? 'clear' : 'night'
      if (code === 2) return 'partly'
      if (code === 3) return 'cloud'
      if (code === 45 || code === 48) return 'fog'
      if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
      if (code >= 95) return 'thunder'
      return 'cloud'
    }
    function themeOf(code, isDay) {
      var kind = artKindOf(code, isDay)
      return { kind: kind, hero: HERO_THEMES[kind] || HERO_THEMES.cloud, badge: BADGE_KIND[kind] || 'cloud' }
    }

    /** Animated SVG weather art for the hero card. Kinds: clear, night,
     *  partly, cloud, fog, rain, snow, thunder. */
    function WeatherArt(props) {
      var kind = (props && props.kind) || 'cloud'
      var size = (props && props.size) || 72
      var defs = h('defs', null,
        h('linearGradient', { id: 'dshwGSun', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0%', 'stop-color': '#ffe08a' }),
          h('stop', { offset: '100%', 'stop-color': '#ff9d3c' })),
        h('linearGradient', { id: 'dshwGMoon', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0%', 'stop-color': '#f0f3ff' }),
          h('stop', { offset: '100%', 'stop-color': '#b9c4f2' })),
        h('linearGradient', { id: 'dshwGCloud', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0%', 'stop-color': '#ffffff' }),
          h('stop', { offset: '100%', 'stop-color': '#c8d6e8' })),
        h('linearGradient', { id: 'dshwGBolt', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0%', 'stop-color': '#ffe27a' }),
          h('stop', { offset: '100%', 'stop-color': '#ffb020' })),
      )
      var sun = (cx, cy, r, rayInner, rayOuter) => {
        var rays = []
        for (var i = 0; i < 8; i += 1) {
          var rad = (i * 45) * Math.PI / 180
          rays.push(h('line', {
            key: 'r' + i,
            x1: cx + Math.cos(rad) * rayInner,
            y1: cy + Math.sin(rad) * rayInner,
            x2: cx + Math.cos(rad) * rayOuter,
            y2: cy + Math.sin(rad) * rayOuter,
            stroke: '#ffd76a', strokeWidth: 2.4, strokeLinecap: 'round',
          }))
        }
        return [
          h('g', { className: 'dshw-art-sun', key: 'sunrays', style: { transformOrigin: cx + 'px ' + cy + 'px' } }, rays),
          h('circle', { key: 'suncore', cx: cx, cy: cy, r: r, fill: 'url(#dshwGSun)' }),
        ]
      }
      var cloud = (x, y, s, cls, opacity) => h('g', {
        className: cls, key: 'cloud' + x + y,
        transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')',
        opacity: opacity === undefined ? 1 : opacity,
      },
        h('ellipse', { cx: -6, cy: 4, rx: 10, ry: 6.5, fill: 'url(#dshwGCloud)' }),
        h('ellipse', { cx: 4, cy: 0, rx: 9, ry: 7.5, fill: 'url(#dshwGCloud)' }),
        h('ellipse', { cx: 12, cy: 5, rx: 8, ry: 5.5, fill: 'url(#dshwGCloud)' }),
      )
      var drops = (fill) => [22, 30, 38].map((x, index) => h('line', {
        key: 'drop' + x, className: 'dshw-art-drop',
        x1: x, y1: 36, x2: x - 2, y2: 42,
        stroke: fill, strokeWidth: 2.4, strokeLinecap: 'round',
        style: { animationDelay: (index * 0.45) + 's' },
      }))
      var flakes = () => [[22, 38], [30, 42], [38, 37]].map((point, index) => h('circle', {
        key: 'flake' + index, className: 'dshw-art-flake',
        cx: point[0], cy: point[1], r: 2, fill: '#eaf5ff',
        style: { animationDelay: (index * 0.7) + 's' },
      }))
      var stars = () => [[14, 14], [48, 18], [44, 40]].map((point, index) => h('circle', {
        key: 'star' + index, className: 'dshw-art-star',
        cx: point[0], cy: point[1], r: 1.6, fill: '#ffffff',
        style: { animationDelay: (index * 0.8) + 's' },
      }))
      var body = null
      if (kind === 'clear') {
        body = sun(32, 30, 11, 15, 21)
      } else if (kind === 'night') {
        body = [
          h('circle', { key: 'moon', cx: 30, cy: 26, r: 12, fill: 'url(#dshwGMoon)' }),
          h('circle', { key: 'crater1', cx: 26, cy: 22, r: 2.5, fill: '#9aa7d8', opacity: .5 }),
          h('circle', { key: 'crater2', cx: 34, cy: 30, r: 2, fill: '#9aa7d8', opacity: .5 }),
          stars(),
        ]
      } else if (kind === 'partly') {
        body = [sun(20, 18, 8, 11, 15.5), cloud(8, 18, 1.2, 'dshw-art-cloud')]
      } else if (kind === 'fog') {
        body = [
          cloud(6, 6, 1.2, 'dshw-art-cloud'),
          h('line', { key: 'fog1', x1: 16, y1: 40, x2: 48, y2: 40, stroke: 'rgba(255,255,255,.55)', strokeWidth: 2.5, strokeLinecap: 'round' }),
          h('line', { key: 'fog2', x1: 22, y1: 46, x2: 42, y2: 46, stroke: 'rgba(255,255,255,.4)', strokeWidth: 2.5, strokeLinecap: 'round' }),
          h('line', { key: 'fog3', x1: 18, y1: 52, x2: 46, y2: 52, stroke: 'rgba(255,255,255,.3)', strokeWidth: 2.5, strokeLinecap: 'round' }),
        ]
      } else if (kind === 'rain') {
        body = [cloud(6, 10, 1.25, 'dshw-art-cloud'), drops('#7db8ff')]
      } else if (kind === 'snow') {
        body = [cloud(6, 10, 1.25, 'dshw-art-cloud'), flakes()]
      } else if (kind === 'thunder') {
        body = [
          cloud(6, 8, 1.25, 'dshw-art-cloud'),
          h('polygon', {
            key: 'bolt', className: 'dshw-art-bolt',
            points: '30,34 25,46 30,46 26,58 38,42 32,42 35,34',
            fill: 'url(#dshwGBolt)',
          }),
        ]
      } else {
        body = [cloud(14, 6, 1, 'dshw-art-cloud', .55), cloud(4, 14, 1.3, 'dshw-art-cloud')]
      }
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true,
        className: props && props.className,
      }, defs, body)
    }

    /** Next-24-hours temperature curve: gradient area + labels every 3h. */
    function HourlyChart(props) {
      var hours = (props && props.hours) || []
      var t = props && props.t
      if (!t || hours.length < 2) return null
      var temps = []
      for (var i = 0; i < hours.length; i += 1) temps.push(hours[i].temperature)
      var min = Math.min.apply(null, temps)
      var max = Math.max.apply(null, temps)
      var span = max - min
      if (!(span > 0)) span = 1
      var line = ''
      for (var j = 0; j < hours.length; j += 1) {
        var x = (j / (hours.length - 1)) * 100
        var y = 30 - ((hours[j].temperature - min) / span) * 24
        line += (j === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' '
      }
      var area = line + 'L 100 34 L 0 34 Z'
      var labels = []
      for (var k = 0; k < hours.length; k += 3) labels.push(hours[k])
      return h('div', { className: 'dshw-chart dshw-rise', style: { animationDelay: '120ms' } },
        h('div', { className: 'dshw-chart-title' }, t('next24h')),
        h('svg', { viewBox: '0 0 100 34', preserveAspectRatio: 'none', 'aria-hidden': true },
          h('defs', null, h('linearGradient', { id: 'dshwGArea', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', 'stop-color': 'rgba(86,148,255,0.4)' }),
            h('stop', { offset: '100%', 'stop-color': 'rgba(86,148,255,0)' }))),
          h('path', { d: area, fill: 'url(#dshwGArea)' }),
          h('path', {
            d: line, fill: 'none', stroke: '#568cff', strokeWidth: 1.6,
            strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke',
          }),
        ),
        h('div', { className: 'dshw-chart-labels' },
          labels.map((label, index) => h('span', { key: String(index), className: 'dshw-chart-label' },
            h('span', { className: 'dshw-chart-hour' }, label.time.slice(11, 16)),
            h('span', { className: 'dshw-chart-temp' }, Math.round(label.temperature) + '°'),
          )),
        ),
      )
    }

    // ---------------------------------------------------------------------------
    // Copy: zh first, en fallback. Registered under the plugin namespace.
    // ---------------------------------------------------------------------------
    var NS = 'dshWeather'
    var ZH = {
      'type.label': '天气',
      'guide.title': '天气预报',
      'guide.description': '当前天气与未来几天预报',
      'back': '返回对话',
      'locating': '定位中…',
      'loading': '正在获取天气…',
      'refresh': '刷新',
      'searchPlaceholder': '搜索城市（如 上海 / Beijing）',
      'search': '搜索',
      'searching': '搜索中…',
      'noResults': '没有找到匹配的城市',
      'retry': '重试',
      'locateFailed': '自动定位失败，请搜索城市',
      'humidity': '湿度',
      'precip': '降水概率',
      'feelsLike': '体感',
      'wind': '风',
      'next24h': '未来 24 小时',
      'updated': '更新于 {time}',
      'source': '数据来源 Open-Meteo · 天气预报可能有误差',
      'today': '今天',
      'tomorrow': '明天',
      'wd0': '周日', 'wd1': '周一', 'wd2': '周二', 'wd3': '周三', 'wd4': '周四', 'wd5': '周五', 'wd6': '周六',
    }
    var EN = {
      'type.label': 'Weather',
      'guide.title': 'Weather forecast',
      'guide.description': 'Current conditions and the next few days',
      'back': 'Back to chat',
      'locating': 'Locating…',
      'loading': 'Loading weather…',
      'refresh': 'Refresh',
      'searchPlaceholder': 'Search a city (e.g. Shanghai / 北京)',
      'search': 'Search',
      'searching': 'Searching…',
      'noResults': 'No matching city',
      'retry': 'Retry',
      'locateFailed': 'Auto-location failed; search a city',
      'humidity': 'Humidity',
      'precip': 'Precipitation',
      'feelsLike': 'Feels like',
      'wind': 'Wind',
      'next24h': 'Next 24 hours',
      'updated': 'Updated {time}',
      'source': 'Data by Open-Meteo · forecasts may be inaccurate',
      'today': 'Today',
      'tomorrow': 'Tomorrow',
      'wd0': 'Sun', 'wd1': 'Mon', 'wd2': 'Tue', 'wd3': 'Wed', 'wd4': 'Thu', 'wd5': 'Fri', 'wd6': 'Sat',
    }

    /** Namespace translator with a zh fallback and {param} interpolation. */
    function makeT(rawT) {
      return function (key, params) {
        var text
        try {
          text = rawT ? rawT(key, params) : undefined
        } catch (error) {
          text = undefined
        }
        if (typeof text !== 'string' || !text) text = ZH[key] || key
        if (params) {
          Object.keys(params).forEach((name) => {
            text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(params[name]))
          })
        }
        return text
      }
    }

    // ---------------------------------------------------------------------------
    // Data layer: Open-Meteo (CORS enabled) + rough IP location + one shared
    // forecast cache for every mounted surface.
    // ---------------------------------------------------------------------------
    var LS_CITY = 'dsh-weather-badge.city.v1'
    var FORECAST_MAX_DAYS = 7
    var CITY_CHANGED_EVENT = 'dsh-weather-badge:city-changed'

    function loadSavedCity() {
      try {
        var raw = localStorage.getItem(LS_CITY)
        if (!raw) return null
        var city = JSON.parse(raw)
        if (city && typeof city.latitude === 'number' && typeof city.longitude === 'number' && typeof city.name === 'string') {
          return city
        }
      } catch (error) { /* ignore broken storage */ }
      return null
    }

    function saveCity(city) {
      try {
        localStorage.setItem(LS_CITY, JSON.stringify(city))
      } catch (error) { /* storage may be unavailable */ }
      try {
        window.dispatchEvent(new CustomEvent(CITY_CHANGED_EVENT))
      } catch (error) { /* non-fatal */ }
    }

    function fetchJson(url, timeoutMs) {
      return fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
    }

    function geocode(name, count) {
      var url = 'https://geocoding-api.open-meteo.com/v1/search?name='
        + encodeURIComponent(name) + '&count=' + (count || 5) + '&language=zh&format=json'
      return fetchJson(url, 10000).then((data) => {
        var results = data && Array.isArray(data.results) ? data.results : []
        return results.map((hit) => ({
          name: String(hit.name || ''),
          admin1: typeof hit.admin1 === 'string' ? hit.admin1 : '',
          country: typeof hit.country === 'string' ? hit.country : '',
          latitude: hit.latitude,
          longitude: hit.longitude,
        })).filter((hit) => hit.name && typeof hit.latitude === 'number' && typeof hit.longitude === 'number')
      })
    }

    function locateByIp() {
      return fetchJson('https://ipwho.is/', 6000).then((data) => {
        if (!data || data.success === false || typeof data.latitude !== 'number') {
          throw new Error('ipwho.is unavailable')
        }
        return {
          name: (typeof data.city === 'string' && data.city) || data.region || data.country || '',
          admin1: typeof data.region === 'string' ? data.region : '',
          country: typeof data.country === 'string' ? data.country : '',
          latitude: data.latitude,
          longitude: data.longitude,
          via: 'ip',
        }
      }).catch(() => fetchJson('https://ipapi.co/json/', 6000).then((data) => {
        if (!data || data.error || typeof data.latitude !== 'number') {
          throw new Error('ipapi.co unavailable')
        }
        return {
          name: (typeof data.city === 'string' && data.city) || data.region || data.country_name || '',
          admin1: typeof data.region === 'string' ? data.region : '',
          country: typeof data.country_name === 'string' ? data.country_name : '',
          latitude: data.latitude,
          longitude: data.longitude,
          via: 'ip',
        }
      })).then(localizeLocation)
    }

    /**
     * IP location answers in English ("Dongguan", "Guangdong Sheng", "China").
     * Re-run the city name through Open-Meteo's Chinese geocoder and keep the
     * hit closest to the IP coordinates, so the card speaks the same language
     * as the rest of the UI. Failures return the original location unchanged.
     */
    function localizeLocation(location) {
      if (!location || !location.name) return location
      // Already Chinese (or at least CJK): nothing to translate.
      if (/[\u3400-\u9fff]/.test(location.name)) return location
      return geocode(location.name, 5).then((hits) => {
        if (hits.length === 0) return location
        var best = hits[0]
        var bestDistance = Infinity
        for (var i = 0; i < hits.length; i += 1) {
          var dx = hits[i].latitude - location.latitude
          var dy = hits[i].longitude - location.longitude
          var distance = dx * dx + dy * dy
          if (distance < bestDistance) {
            bestDistance = distance
            best = hits[i]
          }
        }
        // A name-only match in another country is worse than the English one.
        if (bestDistance > 4) return location
        return {
          name: best.name || location.name,
          admin1: best.admin1 || location.admin1,
          country: best.country || location.country,
          latitude: best.latitude,
          longitude: best.longitude,
          via: location.via,
        }
      }).catch(() => location)
    }

    function fetchForecast(location) {
      var params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day',
        hourly: 'temperature_2m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'auto',
        forecast_days: String(FORECAST_MAX_DAYS),
      })
      return fetchJson('https://api.open-meteo.com/v1/forecast?' + params.toString(), 12000).then((data) => {
        if (!data || !data.current || !data.daily || !Array.isArray(data.daily.time)) {
          throw new Error('unexpected forecast payload')
        }
        // Next 24 hours of temperature, starting at the current local hour.
        var hourlyTimes = data.hourly && Array.isArray(data.hourly.time) ? data.hourly.time : []
        var hourlyTemps = data.hourly && Array.isArray(data.hourly.temperature_2m) ? data.hourly.temperature_2m : []
        var currentKey = typeof data.current.time === 'string' ? data.current.time.slice(0, 13) : ''
        var startIndex = 0
        for (var i = 0; i < hourlyTimes.length; i += 1) {
          if (String(hourlyTimes[i]).slice(0, 13) === currentKey) {
            startIndex = i
            break
          }
        }
        var hours = []
        for (var j = startIndex; j < hourlyTimes.length && hours.length < 24; j += 1) {
          if (typeof hourlyTemps[j] === 'number') {
            hours.push({ time: String(hourlyTimes[j]), temperature: hourlyTemps[j] })
          }
        }
        return {
          location: location,
          current: {
            time: typeof data.current.time === 'string' ? data.current.time : '',
            temperature: data.current.temperature_2m,
            apparentTemperature: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
            weatherCode: data.current.weather_code,
            windSpeed: data.current.wind_speed_10m,
            isDay: data.current.is_day,
          },
          hours: hours,
          daily: data.daily.time.map((date, index) => ({
            date: date,
            weatherCode: data.daily.weather_code[index],
            tempMax: data.daily.temperature_2m_max[index],
            tempMin: data.daily.temperature_2m_min[index],
            precipitationProbability: data.daily.precipitation_probability_max[index],
          })),
          fetchedAt: Date.now(),
        }
      })
    }

    // One shared cache: the top-bar badge, the left panel, and the right tab
    // all hit the same in-flight promise within its TTL instead of
    // triple-fetching.
    var CACHE_TTL_MS = 5 * 60 * 1000
    var forecastCache = { key: null, promise: null, at: 0 }
    function fetchForecastCached(location, force) {
      var key = location.latitude + ',' + location.longitude
      var fresh = forecastCache.promise && forecastCache.key === key && Date.now() - forecastCache.at < CACHE_TTL_MS
      if (!force && fresh) return forecastCache.promise
      forecastCache.key = key
      forecastCache.at = Date.now()
      forecastCache.promise = fetchForecast(location).catch((error) => {
        forecastCache.promise = null
        throw error
      })
      return forecastCache.promise
    }

    function locationLabel(location) {
      var parts = [location.name]
      if (location.admin1 && location.admin1 !== location.name) parts.push(location.admin1)
      if (location.country) parts.push(location.country)
      return parts.filter(Boolean).join(' · ')
    }

    function dayLabel(t, date, index) {
      if (index === 0) return t('today')
      if (index === 1) return t('tomorrow')
      var weekday = new Date(date + 'T00:00:00').getDay()
      return t('wd' + weekday) + ' ' + date.slice(5).replace('-', '/')
    }

    function clockOf(iso) {
      var match = /T(\d{2}:\d{2})/.exec(String(iso || ''))
      return match ? match[1] : ''
    }

    function round1(value) {
      if (typeof value !== 'number' || !isFinite(value)) return null
      return Math.round(value * 10) / 10
    }

    // ---------------------------------------------------------------------------
    // Shared summary hook: current-conditions only, for compact surfaces.
    // Resolves the city (localStorage, else rough IP location), keeps it fresh
    // through the shared cache, and follows city changes from other surfaces.
    // ---------------------------------------------------------------------------
    function useWeatherSummary() {
      var cityState = react.useState(loadSavedCity())
      var city = cityState[0]
      var setCity = cityState[1]
      var summaryRef = react.useRef({ status: 'idle', data: null })
      var tickState = react.useState(0)
      var forceUpdate = react.useCallback(() => {
        tickState[1]((value) => value + 1)
      }, [])

      react.useEffect(() => {
        if (!city) {
          var cancelled = false
          locateByIp().then((location) => {
            if (cancelled) return
            saveCity(location)
            setCity(location)
          }).catch(() => { /* the badge keeps its placeholder */ })
          return () => { cancelled = true }
        }
        // A city saved by an older build may still be in English; translate it
        // once so every surface speaks the UI language.
        if (!/[\u3400-\u9fff]/.test(city.name || '')) {
          var localized = false
          localizeLocation(city).then((next) => {
            if (localized || !next || next.name === city.name) return
            localized = true
            saveCity(next)
            setCity(next)
          }).catch(() => { /* keep the saved name */ })
        }
        var active = true
        fetchForecastCached(city, false).then((data) => {
          if (!active) return
          summaryRef.current = { status: 'ready', data: data }
          forceUpdate()
        }).catch(() => {
          if (!active) return
          summaryRef.current = { status: 'error', data: summaryRef.current.data }
          forceUpdate()
        })
        return () => { active = false }
      }, [city, forceUpdate])

      react.useEffect(() => {
        var onCityChanged = () => setCity(loadSavedCity())
        window.addEventListener(CITY_CHANGED_EVENT, onCityChanged)
        return () => window.removeEventListener(CITY_CHANGED_EVENT, onCityChanged)
      }, [])

      react.useEffect(() => {
        var timer = setInterval(() => {
          var current = loadSavedCity()
          if (!current) return
          fetchForecastCached(current, true).then((data) => {
            summaryRef.current = { status: 'ready', data: data }
            forceUpdate()
          }).catch(() => { /* keep the last summary */ })
        }, 30 * 60 * 1000)
        return () => clearInterval(timer)
      }, [forceUpdate])

      return { city: city, summary: summaryRef.current }
    }

    // ---------------------------------------------------------------------------
    // Icons: the guide/rail glyph (a sun behind a cloud), sized like the
    // built-in guide artwork ({ size, className }).
    // ---------------------------------------------------------------------------
    function WeatherGlyph(props) {
      var size = (props && props.size) || 22
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: props && props.className,
        'aria-hidden': true,
      },
        h('circle', { cx: '8.5', cy: '7.5', r: '2.6' }),
        h('path', { d: 'M8.5 2.6v1.1M3.6 7.5h1.1M4.9 3.9l.8.8M12.1 3.9l-.8.8' }),
        h('path', { d: 'M8 19.5h8.6a3.4 3.4 0 0 0 .5-6.77A5 5 0 0 0 7.4 11.2 3.6 3.6 0 0 0 8 19.5z' }),
      )
    }

    function RefreshGlyph() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        h('path', { d: 'M21 3v6h-6' }),
      )
    }

    // ---------------------------------------------------------------------------
    // The weather card body, shared by the panel and the right tab. Props: `t`
    // (namespace copy) plus whatever else the slot runtime hands over; only
    // `t` is used.
    // ---------------------------------------------------------------------------
    function WeatherBody(props) {
      var t = makeT(props && props.t)
      var dialState = useDialTheme()
      var fontState = useFontChoice()

      // Mutable state lives in refs; `tick` only triggers re-renders.
      var cityRef = react.useRef(loadSavedCity())
      var weatherRef = react.useRef({ status: 'idle', data: null, error: null })
      var locatingRef = react.useRef(cityRef.current === null)
      var locateErrorRef = react.useRef(null)
      var tickState = react.useState(0)
      var forceUpdate = react.useCallback(() => {
        tickState[1]((value) => value + 1)
      }, [])

      var queryState = react.useState('')
      var query = queryState[0]
      var setQuery = queryState[1]
      var searchState = react.useState({ status: 'idle', results: null })
      var search = searchState[0]
      var setSearch = searchState[1]

      var loadWeather = react.useCallback((city, force) => {
        weatherRef.current = { status: 'loading', data: weatherRef.current.data, error: null }
        forceUpdate()
        fetchForecastCached(city, force === true).then((data) => {
          weatherRef.current = { status: 'ready', data: data, error: null }
          forceUpdate()
        }).catch((error) => {
          weatherRef.current = {
            status: weatherRef.current.data ? 'stale' : 'error',
            data: weatherRef.current.data,
            error: error && error.message ? error.message : String(error),
          }
          forceUpdate()
        })
      }, [forceUpdate])

      var chooseCity = react.useCallback((city) => {
        cityRef.current = city
        saveCity(city)
        locatingRef.current = false
        locateErrorRef.current = null
        setSearch({ status: 'idle', results: null })
        setQuery('')
        loadWeather(city, true)
      }, [loadWeather])

      var locate = react.useCallback(() => {
        locatingRef.current = true
        locateErrorRef.current = null
        forceUpdate()
        locateByIp().then((location) => {
          chooseCity(location)
        }).catch((error) => {
          locatingRef.current = false
          locateErrorRef.current = error && error.message ? error.message : String(error)
          forceUpdate()
        })
      }, [chooseCity, forceUpdate])

      // Initial load: saved city → weather; no city → IP location.
      var bootstrapped = react.useRef(false)
      react.useEffect(() => {
        if (bootstrapped.current) return
        bootstrapped.current = true
        if (cityRef.current) loadWeather(cityRef.current, false)
        else locate()
      }, [loadWeather, locate])

      // Follow city changes made on other surfaces (badge ↔ panel ↔ tab).
      react.useEffect(() => {
        var onCityChanged = () => {
          var next = loadSavedCity()
          if (next && cityRef.current && next.latitude === cityRef.current.latitude && next.longitude === cityRef.current.longitude) return
          cityRef.current = next
          if (next) loadWeather(next, false)
        }
        window.addEventListener(CITY_CHANGED_EVENT, onCityChanged)
        return () => window.removeEventListener(CITY_CHANGED_EVENT, onCityChanged)
      }, [loadWeather])

      // Refresh automatically every 30 minutes while mounted.
      react.useEffect(() => {
        var timer = setInterval(() => {
          if (cityRef.current) loadWeather(cityRef.current, true)
        }, 30 * 60 * 1000)
        return () => clearInterval(timer)
      }, [loadWeather])

      var runSearch = react.useCallback(() => {
        var name = query.trim()
        if (!name) return
        setSearch({ status: 'searching', results: null })
        geocode(name, 5).then((results) => {
          setSearch({ status: results.length > 0 ? 'results' : 'empty', results: results })
        }).catch((error) => {
          setSearch({ status: 'error', results: null, error: error && error.message ? error.message : String(error) })
        })
      }, [query])

      var city = cityRef.current
      var weather = weatherRef.current
      var locating = locatingRef.current

      var children = []

      // Header: city name + refresh.
      children.push(h('div', { key: 'head', className: 'dshw-head' },
        h('span', { key: 'city', className: 'dshw-city' },
          city ? locationLabel(city) : t('locating'),
          city && city.via === 'ip' ? h('span', { className: 'dshw-cityhint' }, 'IP') : null,
        ),
        h('button', {
          key: 'refresh',
          type: 'button',
          className: 'dshw-iconbtn',
          title: t('refresh'),
          'aria-label': t('refresh'),
          disabled: !city || weather.status === 'loading',
          onClick: () => { if (cityRef.current) loadWeather(cityRef.current, true) },
        }, h(RefreshGlyph)),
      ))

      // Dial theme picker: five silhouettes, shared with the account chip.
      children.push(h('div', { key: 'dial', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, '表盘主题'),
        h('div', { className: 'dshw-dial-swatches' },
          DIAL_THEMES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: 'dshw-dial-swatch',
            'data-active': item.id === dialState[0] ? '1' : '0',
            title: item.label,
            'aria-label': item.label,
            onClick: () => dialState[1](item.id),
          }, h(DialSwatch, { id: item.id }))),
        ),
      ))

      // Font picker: same five stacks, shared with the account chip.
      children.push(h('div', { key: 'font', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, '字体'),
        h('div', { className: 'dshw-dial-swatches' },
          FONT_CHOICES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: 'dshw-font',
            style: { fontFamily: item.stack },
            'data-active': item.id === fontState[0] ? '1' : '0',
            title: item.label,
            'aria-label': item.label,
            onClick: () => fontState[1](item.id),
          }, item.label)),
        ),
      ))

      // City search box + results.
      children.push(h('div', { key: 'search', className: 'dshw-search' },
        h('input', {
          value: query,
          placeholder: t('searchPlaceholder'),
          onChange: (event) => setQuery(event.target.value),
          onKeyDown: (event) => { if (event.key === 'Enter') runSearch() },
        }),
        h('button', { type: 'button', className: 'dshw-searchbtn', disabled: search.status === 'searching' || !query.trim(), onClick: runSearch },
          search.status === 'searching' ? t('searching') : t('search')),
      ))
      if (search.status === 'results' && search.results) {
        children.push(h('div', { key: 'results', className: 'dshw-results' },
          search.results.map((result, index) => h('button', {
            key: String(index),
            type: 'button',
            className: 'dshw-result',
            onClick: () => chooseCity({
              name: result.name,
              admin1: result.admin1,
              country: result.country,
              latitude: result.latitude,
              longitude: result.longitude,
              via: 'search',
            }),
          }, locationLabel(result)),
        )))
      } else if (search.status === 'empty') {
        children.push(h('div', { key: 'noresults', className: 'dshw-banner' }, t('noResults')))
      } else if (search.status === 'error') {
        children.push(h('div', { key: 'searcherror', className: 'dshw-errortext' }, search.error))
      }

      // States.
      if (locating) {
        children.push(h('div', { key: 'locating', className: 'dshw-status' }, t('locating')))
      } else if (locateErrorRef.current && !city) {
        children.push(h('div', { key: 'locateerror', className: 'dshw-error' },
          h('span', { className: 'dshw-errortext' }, t('locateFailed')),
          h('button', { type: 'button', className: 'dshw-retry', onClick: locate }, t('retry')),
        ))
      } else if (weather.status === 'loading' && !weather.data) {
        children.push(h('div', { key: 'loading', className: 'dshw-status' }, t('loading')))
      } else if ((weather.status === 'error' || weather.status === 'stale') && weather.error) {
        children.push(h('div', { key: 'error', className: 'dshw-error' },
          h('span', { className: 'dshw-errortext' }, weather.error),
          h('button', {
            type: 'button',
            className: 'dshw-retry',
            onClick: () => { if (cityRef.current) loadWeather(cityRef.current, true) },
          }, t('retry')),
        ))
      }

      // Weather content: hero card, 24h curve, 7-day rows.
      if (weather.data) {
        var data = weather.data
        var current = data.current
        var temp = round1(current.temperature)
        var feels = round1(current.apparentTemperature)
        var timeHour = Number(String(current.time || '').slice(11, 13))
        var isDay = current.isDay === 1 ? true : current.isDay === 0 ? false : (timeHour >= 6 && timeHour < 18)
        var theme = themeOf(current.weatherCode, isDay)
        var chips = []
        if (feels !== null) chips.push(t('feelsLike') + ' ' + feels + '°C')
        if (typeof current.humidity === 'number') chips.push(t('humidity') + ' ' + Math.round(current.humidity) + '%')
        if (typeof current.windSpeed === 'number') chips.push(t('wind') + ' ' + Math.round(current.windSpeed) + ' km/h')
        if (data.daily.length > 0 && typeof data.daily[0].precipitationProbability === 'number') {
          chips.push(t('precip') + ' ' + Math.round(data.daily[0].precipitationProbability) + '%')
        }
        children.push(h('div', { key: 'hero', className: 'dshw-hero dshw-rise', style: { '--dshw-hero': theme.hero } },
          h('div', { className: 'dshw-hero-top' },
            h('div', null,
              h('div', { className: 'dshw-hero-temp' }, temp === null ? '—' : Math.round(current.temperature) + '°'),
              h('div', { className: 'dshw-hero-desc' }, codeText(current.weatherCode),
                feels !== null && feels !== temp ? ' · ' + t('feelsLike') + ' ' + feels + '°C' : ''),
            ),
            h('div', { className: 'dshw-hero-art' }, h(WeatherArt, { kind: theme.kind, size: 72 })),
          ),
          h('div', { className: 'dshw-hero-chips' },
            chips.map((chip, index) => h('span', { key: String(index), className: 'dshw-chip' }, chip)),
          ),
        ))
        children.push(h(HourlyChart, { key: 'hours', hours: data.hours, t: t }))
        var weekMin = Infinity
        var weekMax = -Infinity
        for (var d = 0; d < data.daily.length; d += 1) {
          if (typeof data.daily[d].tempMin === 'number' && data.daily[d].tempMin < weekMin) weekMin = data.daily[d].tempMin
          if (typeof data.daily[d].tempMax === 'number' && data.daily[d].tempMax > weekMax) weekMax = data.daily[d].tempMax
        }
        var weekSpan = weekMax - weekMin
        if (!(weekSpan > 0)) weekSpan = 1
        children.push(h('div', { key: 'days', className: 'dshw-days' },
          data.daily.map((day, index) => {
            var max = round1(day.tempMax)
            var min = round1(day.tempMin)
            var precip = typeof day.precipitationProbability === 'number' ? Math.round(day.precipitationProbability) + '%' : '—'
            var left = typeof day.tempMin === 'number' ? ((day.tempMin - weekMin) / weekSpan) * 100 : 0
            var width = typeof day.tempMax === 'number' && typeof day.tempMin === 'number'
              ? ((day.tempMax - day.tempMin) / weekSpan) * 100 : 0
            if (width < 6) width = 6
            return h('div', {
              key: day.date + String(index),
              className: 'dshw-day dshw-rise',
              style: { animationDelay: (160 + index * 40) + 'ms' },
            },
              h('span', { className: 'dshw-day-name' }, dayLabel(t, day.date, index)),
              h('span', { className: 'dshw-day-emoji' }, codeEmoji(day.weatherCode)),
              h('span', { className: 'dshw-day-text' }, codeText(day.weatherCode) + ' · ' + t('precip') + ' ' + precip),
              h('span', { className: 'dshw-range' },
                h('span', { className: 'dshw-range-fill', style: { left: left + '%', width: width + '%' } })),
              h('span', { className: 'dshw-day-temp' }, (min === null ? '—' : min) + '~' + (max === null ? '—' : max) + '°'),
            )
          }),
        ))
        var updated = new Date(data.fetchedAt)
        var clock = ('0' + updated.getHours()).slice(-2) + ':' + ('0' + updated.getMinutes()).slice(-2)
        children.push(h('div', { key: 'foot', className: 'dshw-foot' },
          t('updated', { time: clock }) + ' · ' + t('source'),
        ))
      }

      return h('div', { className: 'dshw-root' }, children)
    }

    // ---------------------------------------------------------------------------
    // The account-row chip: a live clock plus the current weather, injected
    // right of the account launcher in the sidebar foot. The shipped row owns
    // no extension seat, so this follows the DOM-injection pattern other
    // plugins use; clicking the weather half toggles the full panel.
    // ---------------------------------------------------------------------------
    function pad2(value) {
      return (value < 10 ? '0' : '') + value
    }

    /**
     * A round analog clock that actually runs: hour, minute and second hands
     * rotate from the current time, redrawn once a second. Drawn as inline SVG
     * so it inherits the surrounding text color and needs no assets.
     */
    // ---------------------------------------------------------------------------
    // Dial themes: each theme owns a distinct OUTLINE, not just a colour. Every
    // silhouette stays at r >= 44 in all twelve numeral directions, so the
    // digits (r = 36.5, outer edge about 42.5) and the hands (max 29) always sit
    // inside it. Shapes are simple, original, asset-free vectors.
    // ---------------------------------------------------------------------------
    var LS_DIAL = 'dsh-weather-badge.dial.v2'
    var DEFAULT_DIAL = 'aurora'
    var DIAL_CHANGED_EVENT = 'dsh-weather-badge:dial-changed'
    // 六款表盘：换的是整套画面，不是换个底色——多段渐变面料 + 专属装饰层 +
    // 各自的指针配色。装饰全部是内联矢量，不依赖任何图片资源。
    var DIAL_THEMES = [
      { id: 'aurora', label: '晨光极光', numerals: true, ink: '#2d3d52', major: '#a9812f',
        stops: [['0%', '#ffffff'], ['55%', '#eef5ff'], ['100%', '#dbe8f7']],
        hour: '#33455e', minute: '#2f7fc1', second: '#d24a4a' },
      { id: 'galaxy', label: '浅雾星河', numerals: true, ink: '#403758', major: '#a9812f',
        stops: [['0%', '#fdfcff'], ['60%', '#f1ecff'], ['100%', '#e2dcf7']],
        hour: '#463c66', minute: '#6a5aa8', second: '#c2557f' },
      { id: 'cyber', label: '浅青霓虹', numerals: true, ink: '#25434e', major: '#a9812f',
        stops: [['0%', '#ffffff'], ['100%', '#e2f2f7']],
        hour: '#2b4a55', minute: '#1587a8', second: '#c9333f' },
      { id: 'crystal', label: '水晶金属', numerals: true, ink: '#26405e', major: '#a9812f',
        stops: [['0%', '#ffffff'], ['65%', '#eef4fb'], ['100%', '#c7d9ea']],
        hour: '#26405e', minute: '#3d78b8', second: '#c45863' },
      { id: 'wave', label: '浮世绘海浪', numerals: true, ink: '#243642', major: '#a9812f',
        stops: [['0%', '#fdf6e6'], ['100%', '#efe0c2']],
        hour: '#262c34', minute: '#225a78', second: '#c63e2c' },
      { id: 'mandala', label: '浅色曼陀罗', numerals: true, ink: '#553a6b', major: '#a9812f',
        stops: [['0%', '#fffafd'], ['55%', '#f6ecff'], ['100%', '#e8d8fa']],
        hour: '#5a3a72', minute: '#8a52a8', second: '#c6547f' },
    ]
    var DIAL_SHAPE_IDS = ['aurora', 'galaxy', 'cyber', 'crystal', 'wave', 'mandala']

    /** 极坐标半径：angle 为角度制，返回距圆心 50,50 的半径。 */
    function dialRadius(id, angle) {
      var a = angle * Math.PI / 180
      // 曼陀罗带十二瓣浅起伏，其余五款保持正圆，靠内部画面区分。
      if (id === 'mandala') return 45.8 + 1.5 * Math.cos(12 * a)
      return 47
    }

    var dialPathCache = {}

    /** 采样 96 个点生成闭合轮廓；弦高误差远小于一个像素，视觉上是光滑曲线。 */
    function dialPath(id) {
      var key = DIAL_SHAPE_IDS.indexOf(id) >= 0 ? id : 'classic'
      if (dialPathCache[key]) return dialPathCache[key]
      var segments = 96
      var parts = []
      for (var i = 0; i < segments; i += 1) {
        var angle = (i * 360) / segments
        var rad = dialRadius(key, angle) * 1
        var x = 50 + Math.cos(angle * Math.PI / 180) * rad
        var y = 50 + Math.sin(angle * Math.PI / 180) * rad
        parts.push((i === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2))
      }
      var path = parts.join(' ') + ' Z'
      dialPathCache[key] = path
      return path
    }

    /** 兼容旧代码：主题 id 必须在该表内，否则回落到素雅。 */
    var DIAL_SHAPES = (function () {
      var map = {}
      for (var i = 0; i < DIAL_SHAPE_IDS.length; i += 1) map[DIAL_SHAPE_IDS[i]] = true
      return map
    })()

    function dialTheme(id) {
      for (var i = 0; i < DIAL_THEMES.length; i += 1) {
        if (DIAL_THEMES[i].id === id) return DIAL_THEMES[i]
      }
      return DIAL_THEMES[1]
    }

    /** 主题专属装饰层：全部落在 r>32 的外圈，不挡住指针与数字。 */
    function dialDecor(id) {
      var out = []
      var i
      if (id === 'aurora') {
        // 极光：两条发光弧带 + 一圈细刻度 + 稀疏星点
        out.push(h('path', {
          key: 'n1', d: 'M 12 62 Q 30 30 50 34 Q 70 38 88 66', fill: 'none',
          stroke: '#6ee7ff', strokeWidth: 3.4, strokeLinecap: 'round', opacity: 0.5, className: 'dshw-glow',
        }))
        out.push(h('path', {
          key: 'n2', d: 'M 16 72 Q 34 46 52 48 Q 70 50 86 74', fill: 'none',
          stroke: '#b388ff', strokeWidth: 2.4, strokeLinecap: 'round', opacity: 0.42,
        }))
        for (i = 0; i < 60; i += 1) {
          var ta = (i * 6 - 90) * Math.PI / 180
          var r1 = i % 5 === 0 ? 44 : 45.5
          out.push(h('line', {
            key: 'tk' + i,
            x1: 50 + Math.cos(ta) * r1, y1: 50 + Math.sin(ta) * r1,
            x2: 50 + Math.cos(ta) * 46.8, y2: 50 + Math.sin(ta) * 46.8,
            stroke: '#9fe8ff', strokeWidth: i % 5 === 0 ? 0.9 : 0.5, opacity: 0.55,
          }))
        }
        var stars = [[22, 26], [74, 22], [80, 58], [26, 76], [62, 78], [40, 20]]
        for (i = 0; i < stars.length; i += 1) {
          out.push(h('circle', { key: 'st' + i, cx: stars[i][0], cy: stars[i][1], r: i % 2 ? 0.7 : 1, fill: '#eaf7ff', opacity: 0.75 }))
        }
        return out
      }
      if (id === 'galaxy') {
        // 星河：银河光带 + 大量星点（分三档亮度，位置写死保证渲染稳定）
        out.push(h('ellipse', {
          key: 'mw', cx: 50, cy: 50, rx: 44, ry: 15, fill: 'none',
          stroke: '#9aa8ff', strokeWidth: 9, opacity: 0.14, transform: 'rotate(-28 50 50)',
        }))
        out.push(h('ellipse', {
          key: 'mw2', cx: 50, cy: 50, rx: 41, ry: 8, fill: 'none',
          stroke: '#ffe9b8', strokeWidth: 4, opacity: 0.16, transform: 'rotate(-28 50 50)',
        }))
        var seed = 7
        for (i = 0; i < 54; i += 1) {
          seed = (seed * 1103515245 + 12345) % 2147483648
          var sa = (seed / 2147483648) * Math.PI * 2
          seed = (seed * 1103515245 + 12345) % 2147483648
          var sr = 9 + (seed / 2147483648) * 37
          out.push(h('circle', {
            key: 'gs' + i,
            cx: 50 + Math.cos(sa) * sr, cy: 50 + Math.sin(sa) * sr,
            r: i % 7 === 0 ? 1.1 : 0.55,
            fill: i % 5 === 0 ? '#ffe9b8' : '#dbe6ff',
            opacity: i % 7 === 0 ? 0.9 : 0.5,
          }))
        }
        return out
      }
      if (id === 'cyber') {
        // 赛博霓虹：内外两道霓虹环 + 十二个方形节点
        out.push(h('circle', { key: 'c1', cx: 50, cy: 50, r: 44.5, fill: 'none', stroke: '#00e5ff', strokeWidth: 1.2, opacity: 0.8 }))
        out.push(h('circle', { key: 'c2', cx: 50, cy: 50, r: 41, fill: 'none', stroke: '#ff2fb8', strokeWidth: 0.8, opacity: 0.5 }))
        for (i = 0; i < 12; i += 1) {
          var ca = (i * 30 - 90) * Math.PI / 180
          out.push(h('rect', {
            key: 'cn' + i,
            x: 50 + Math.cos(ca) * 45.4 - 1.5, y: 50 + Math.sin(ca) * 45.4 - 1.5,
            width: 3, height: 3,
            fill: i % 2 ? '#ff2fb8' : '#00e5ff', opacity: 0.85,
          }))
        }
        return out
      }
      if (id === 'crystal') {
        // 水晶金属：金色分段外环 + 顶部高光扇形 + 内圈细金线
        for (i = 0; i < 36; i += 1) {
          var ga = (i * 10 - 90) * Math.PI / 180
          out.push(h('line', {
            key: 'cg' + i,
            x1: 50 + Math.cos(ga) * 43.4, y1: 50 + Math.sin(ga) * 43.4,
            x2: 50 + Math.cos(ga) * 46.6, y2: 50 + Math.sin(ga) * 46.6,
            stroke: i % 3 === 0 ? '#c9a227' : '#dcc98a',
            strokeWidth: i % 3 === 0 ? 1.6 : 0.9, opacity: 0.85,
          }))
        }
        out.push(h('circle', { key: 'cr', cx: 50, cy: 50, r: 42.4, fill: 'none', stroke: '#b99b3f', strokeWidth: 0.7, opacity: 0.6 }))
        out.push(h('path', {
          key: 'hl', d: 'M 50 6 A 44 44 0 0 1 90 34 Q 66 18 50 6 Z',
          fill: '#ffffff', opacity: 0.55,
        }))
        out.push(h('path', {
          key: 'hl2', d: 'M 50 94 A 44 44 0 0 1 10 66 Q 34 82 50 94 Z',
          fill: '#ffffff', opacity: 0.22,
        }))
        return out
      }
      if (id === 'wave') {
        // 浮世绘海浪：红日 + 三层错落浪线 + 浪花点
        out.push(h('circle', { key: 'sun', cx: 68, cy: 30, r: 9, fill: '#d94f3d', opacity: 0.85 }))
        out.push(h('path', {
          key: 'w1', d: 'M 4 66 Q 20 54 34 62 Q 48 70 60 60 Q 72 50 96 64 L 96 96 L 4 96 Z',
          fill: '#2c6d8c', opacity: 0.85,
        }))
        out.push(h('path', {
          key: 'w2', d: 'M 4 74 Q 18 66 32 72 Q 46 78 60 70 Q 74 62 96 74 L 96 96 L 4 96 Z',
          fill: '#1c4a63', opacity: 0.9,
        }))
        out.push(h('path', {
          key: 'w3', d: 'M 4 84 Q 22 78 38 84 Q 54 90 70 82 Q 84 76 96 84 L 96 96 L 4 96 Z',
          fill: '#122f42', opacity: 0.95,
        }))
        var foam = [[16, 60], [40, 57], [66, 55], [86, 60], [28, 68], [54, 66], [78, 70]]
        for (i = 0; i < foam.length; i += 1) {
          out.push(h('circle', { key: 'fo' + i, cx: foam[i][0], cy: foam[i][1], r: 1.6, fill: '#fdf6e6', opacity: 0.9 }))
        }
        return out
      }
      // 曼陀罗：三层花瓣 + 金色同心环
      for (i = 0; i < 12; i += 1) {
        var ma = (i * 30 - 90) * Math.PI / 180
        out.push(h('path', {
          key: 'mp' + i,
          d: 'M ' + (50 + Math.cos(ma) * 30).toFixed(2) + ' ' + (50 + Math.sin(ma) * 30).toFixed(2)
            + ' Q ' + (50 + Math.cos(ma - 0.18) * 44).toFixed(2) + ' ' + (50 + Math.sin(ma - 0.18) * 44).toFixed(2)
            + ' ' + (50 + Math.cos(ma) * 46).toFixed(2) + ' ' + (50 + Math.sin(ma) * 46).toFixed(2)
            + ' Q ' + (50 + Math.cos(ma + 0.18) * 44).toFixed(2) + ' ' + (50 + Math.sin(ma + 0.18) * 44).toFixed(2)
            + ' ' + (50 + Math.cos(ma) * 30).toFixed(2) + ' ' + (50 + Math.sin(ma) * 30).toFixed(2) + ' Z',
          fill: i % 2 ? '#ffd6a0' : '#ff96c8', opacity: 0.26,
        }))
      }
      out.push(h('circle', { key: 'mr1', cx: 50, cy: 50, r: 43, fill: 'none', stroke: '#ffd6a0', strokeWidth: 0.8, opacity: 0.7 }))
      out.push(h('circle', { key: 'mr2', cx: 50, cy: 50, r: 27, fill: 'none', stroke: '#ffd6a0', strokeWidth: 0.6, opacity: 0.5 }))
      return out
    }
    function loadDial() {
      try {
        var stored = window.localStorage.getItem(LS_DIAL)
        return DIAL_SHAPES[stored] ? stored : DEFAULT_DIAL
      } catch (error) {
        return DEFAULT_DIAL
      }
    }

    function saveDial(id) {
      try {
        window.localStorage.setItem(LS_DIAL, id)
      } catch (error) { /* storage may be blocked */ }
    }

    /** The selected dial, kept in sync between the account chip and the panel. */
    function useDialTheme() {
      var state = react.useState(loadDial)
      var dial = state[0]
      var setState = state[1]
      react.useEffect(() => {
        var onChange = (event) => {
          var next = event && event.detail ? event.detail.dial : null
          if (!DIAL_SHAPES[next]) next = loadDial()
          setState((current) => (current === next ? current : next))
        }
        window.addEventListener(DIAL_CHANGED_EVENT, onChange)
        return () => window.removeEventListener(DIAL_CHANGED_EVENT, onChange)
      }, [])
      var setDial = react.useCallback((next) => {
        if (!DIAL_SHAPES[next]) return
        saveDial(next)
        setState(next)
        try {
          window.dispatchEvent(new CustomEvent(DIAL_CHANGED_EVENT, { detail: { dial: next } }))
        } catch (error) { /* the app shell always provides CustomEvent */ }
      }, [])
      return [dial, setDial]
    }

    // 字体：徽章文字与表盘数字共用一套，用户可在面板里切换并本地记住。
    var LS_FONT = 'dsh-weather-badge.font.v1'
    var DEFAULT_FONT = 'kai'
    var FONT_CHANGED_EVENT = 'dsh-weather-badge:font-changed'
    var FONT_CHOICES = [
      { id: 'kai', label: '楷体', stack: '"Kaiti SC","STKaiti","KaiTi","FangSong","STFangsong","Songti SC","STSong","SimSun",Georgia,"Times New Roman",serif' },
      { id: 'song', label: '宋体', stack: '"Songti SC","STSong","SimSun","Noto Serif SC",Georgia,serif' },
      { id: 'times', label: 'Times', stack: 'Georgia,"Times New Roman",Times,serif' },
      { id: 'hei', label: '黑体', stack: '"PingFang SC","Microsoft YaHei","Segoe UI","Noto Sans SC",sans-serif' },
      { id: 'mono', label: '等宽', stack: '"Cascadia Mono","Consolas","Sarasa Mono SC","Noto Sans Mono",monospace' },
    ]

    function fontStack(id) {
      for (var i = 0; i < FONT_CHOICES.length; i += 1) {
        if (FONT_CHOICES[i].id === id) return FONT_CHOICES[i].stack
      }
      return FONT_CHOICES[0].stack
    }

    function loadFont() {
      try {
        var stored = window.localStorage.getItem(LS_FONT)
        for (var i = 0; i < FONT_CHOICES.length; i += 1) {
          if (FONT_CHOICES[i].id === stored) return stored
        }
        return DEFAULT_FONT
      } catch (error) {
        return DEFAULT_FONT
      }
    }

    /** 选中的字体，账号徽章与面板共享同一份状态。 */
    function useFontChoice() {
      var state = react.useState(loadFont)
      var font = state[0]
      var setState = state[1]
      react.useEffect(() => {
        var onChange = (event) => {
          var next = event && event.detail ? event.detail.font : null
          if (!next) next = loadFont()
          setState((current) => (current === next ? current : next))
        }
        window.addEventListener(FONT_CHANGED_EVENT, onChange)
        return () => window.removeEventListener(FONT_CHANGED_EVENT, onChange)
      }, [])
      var setFont = react.useCallback((next) => {
        if (!next) return
        try {
          window.localStorage.setItem(LS_FONT, next)
        } catch (error) { /* storage may be blocked */ }
        setState(next)
        try {
          window.dispatchEvent(new CustomEvent(FONT_CHANGED_EVENT, { detail: { font: next } }))
        } catch (error) { /* the app shell always provides CustomEvent */ }
      }, [])
      return [font, setFont]
    }

    var faceSeq = 0

    /**
     * A round analog clock that actually runs: hour, minute and second hands
     * rotate from the current time, redrawn once a second. Drawn as inline SVG
     * so it inherits the surrounding text color and needs no assets. The face
     * carries twelve serif arabic numerals and follows the selected dial theme.
     */
    function AnalogClock(props) {
      var size = (props && props.size) || 46
      var external = props && props.now instanceof Date ? props.now : null
      var nowState = react.useState(() => new Date())
      var setNow = nowState[1]
      var idRef = react.useRef(null)
      if (idRef.current === null) {
        faceSeq += 1
        idRef.current = 'dshwFace' + faceSeq
      }
      react.useEffect(() => {
        if (external) return undefined
        var timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
      }, [external ? 1 : 0])
      var now = external || nowState[0]
      var seconds = now.getSeconds()
      var minutes = now.getMinutes() + seconds / 60
      var hours = (now.getHours() % 12) + minutes / 60
      var secondAngle = seconds * 6
      var minuteAngle = minutes * 6
      var hourAngle = hours * 30
      var center = 50
      var dialId = (props && props.dial) || DEFAULT_DIAL
      var theme = dialTheme(dialId)
      var faceId = idRef.current
      var hand = (angle, length, width, opacity, className, color) => {
        var rad = (angle - 90) * Math.PI / 180
        return h('line', {
          key: 'hand-' + className,
          className: className,
          x1: center,
          y1: center,
          x2: center + Math.cos(rad) * length,
          y2: center + Math.sin(rad) * length,
          stroke: color,
          strokeWidth: width,
          strokeLinecap: 'round',
          opacity: opacity,
        })
      }
      var numerals = []
      for (var n = 0; theme.numerals && n < 12; n += 1) {
        var numRad = (n * 30 - 90) * Math.PI / 180
        var label = n === 0 ? 12 : n
        var major = label % 3 === 0
        numerals.push(h('text', {
          key: 'numeral' + n,
          x: center + Math.cos(numRad) * 36.5,
          y: center + Math.sin(numRad) * 36.5,
          textAnchor: 'middle',
          dominantBaseline: 'central',
          fontSize: 13,
          fill: major ? theme.major : theme.ink,
          fontWeight: major ? 600 : 500,
          className: major ? 'dshw-numeral dshw-numeral-major' : 'dshw-numeral',
        }, String(label)))
      }
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 100 100',
        role: 'img',
        'aria-label': pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
        className: props && props.className,
      },
        h('defs', null,
          h('radialGradient', { id: faceId, cx: '46%', cy: '30%', r: '82%' },
            theme.stops.map((pair, index) => h('stop', {
              key: 'stop' + index, offset: pair[0], 'stop-color': pair[1],
            }))),
          // 装饰层（海浪/星点/花瓣等）一律裁到表盘轮廓内，绝不出圈。
          h('clipPath', { id: faceId + 'clip' }, h('path', { d: dialPath(dialId) }))),
        // Face and outer bezel share ONE silhouette, so the outline itself
        // changes with the selected theme, not just the fill colour.
        h('path', {
          d: dialPath(dialId), fill: 'url(#' + faceId + ')', 'data-dial': dialId, className: 'dshw-dial-face',
        }),
        h('circle', {
          cx: center, cy: center, r: 42.6, fill: 'none', stroke: theme.hour, strokeWidth: 0.8, opacity: 0.18,
        }),
        h('path', {
          d: dialPath(dialId), fill: 'none', stroke: theme.hour, strokeWidth: 1.6, opacity: 0.55, className: 'dshw-bezel',
        }),
        h('g', { clipPath: 'url(#' + faceId + 'clip)' }, dialDecor(dialId), numerals),
        hand(hourAngle, 20, 3.6, 0.95, 'dshw-hand-hour', theme.hour),
        hand(minuteAngle, 26, 2.4, 0.95, 'dshw-hand-minute', theme.minute),
        hand(secondAngle, 29, 1.1, 0.9, 'dshw-hand-second', theme.second),
        h('circle', { cx: center, cy: center, r: 2.6, className: 'dshw-hand-dot', fill: theme.second }),
      )
    }

    /** The picker thumbnail: the same silhouette, filled and outlined. */
    function DialSwatch(props) {
      var id = (props && props.id) || DEFAULT_DIAL
      var theme = dialTheme(id)
      var gradientId = 'dshwSwatch-' + id
      return h('svg', { viewBox: '0 0 100 100', 'aria-hidden': true },
        h('defs', null,
          h('radialGradient', { id: gradientId, cx: '46%', cy: '30%', r: '82%' },
            theme.stops.map((pair, index) => h('stop', {
              key: 'stop' + index, offset: pair[0], 'stop-color': pair[1],
            }))),
          h('clipPath', { id: gradientId + 'clip' }, h('path', { d: dialPath(id) }))),
        h('path', { d: dialPath(id), fill: 'url(#' + gradientId + ')' }),
        h('g', { clipPath: 'url(#' + gradientId + 'clip)' }, dialDecor(id)),
        h('path', { d: dialPath(id), fill: 'none', stroke: theme.hour, strokeWidth: 2.4, opacity: 0.6 }),
      )
    }

    /** 每秒刷新一次的当前时间。 */
    function useNow() {
      var state = react.useState(() => new Date())
      var setNow = state[1]
      react.useEffect(() => {
        var timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
      }, [])
      return state[0]
    }

    // 天气表盘的配色：按天气种类取一对浅到深的颜色，做内圈径向渐变。
    var WEATHER_DIAL_COLORS = {
      clear: { hi: '#ffeaa9', lo: '#f0a93c' },
      night: { hi: '#ccd6ff', lo: '#3a4680' },
      partly: { hi: '#e3f0ff', lo: '#6aa6e0' },
      cloud: { hi: '#e9eff6', lo: '#7a92ab' },
      fog: { hi: '#ebf0f5', lo: '#8b9aa8' },
      rain: { hi: '#d9eaff', lo: '#3f6fb5' },
      snow: { hi: '#f0f8ff', lo: '#7fb4dd' },
      thunder: { hi: '#e5dbff', lo: '#6b53a8' },
    }

    /**
     * 天气表盘：和时钟表盘并排的第二枚小表盘，圆面内是天气图标，
     * 下方一行温度。体积固定，刷新只改文本，不参与布局。
     */
    function WeatherDial(props) {
      var size = (props && props.size) || 38
      var code = props && props.code
      var isDay = props && props.isDay
      var kind = artKindOf(code, isDay)
      var palette = WEATHER_DIAL_COLORS[kind] || WEATHER_DIAL_COLORS.cloud
      var gradientId = 'dshwWx' + kind
      var temperature = props && props.temperature
      var label = typeof temperature === 'number' ? Math.round(temperature) + '℃' : '—'
      // 湿度外环：周长按 0-100% 截取，用 dash 画弧，不额外占布局。
      var humidity = props && typeof props.humidity === 'number' ? Math.max(0, Math.min(100, props.humidity)) : null
      var ringRadius = 49
      var ringLength = 2 * Math.PI * ringRadius
      var ringDash = humidity === null ? 0 : (ringLength * humidity) / 100
      return h('svg', {
        viewBox: '-5 -5 110 110',
        width: size,
        height: size,
        className: 'dshw-wxdial',
        role: 'img',
        'aria-label': label,
      },
        h('defs', null,
          h('radialGradient', { id: gradientId, cx: '50%', cy: '34%', r: '72%' },
            h('stop', { offset: '0%', 'stop-color': palette.hi }),
            h('stop', { offset: '100%', 'stop-color': palette.lo }))),
        humidity === null ? null : h('circle', {
          cx: 50, cy: 50, r: ringRadius,
          fill: 'none', stroke: 'currentColor', strokeWidth: 5, opacity: 0.14,
        }),
        humidity === null ? null : h('circle', {
          cx: 50, cy: 50, r: ringRadius,
          fill: 'none',
          stroke: '#2f86c8',
          strokeWidth: 5,
          strokeLinecap: 'round',
          strokeDasharray: ringDash + ' ' + ringLength,
          opacity: 0.9,
          transform: 'rotate(-90 50 50)',
        }),
        h('circle', { cx: 50, cy: 50, r: 46, fill: 'url(#' + gradientId + ')' }),
        h('circle', { cx: 50, cy: 50, r: 46, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, opacity: 0.42 }),
        h('circle', { cx: 50, cy: 50, r: 39, fill: 'none', stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.16 }),
        h('text', { x: 50, y: 33, textAnchor: 'middle', dominantBaseline: 'central', fontSize: 24 }, codeEmoji(code)),
        h('text', {
          x: 50, y: 56, textAnchor: 'middle', dominantBaseline: 'central',
          fontSize: 25, fontWeight: 600, className: 'dshw-wxdial-temp',
        }, label),
        humidity === null ? null : h('text', {
          x: 50, y: 79, textAnchor: 'middle', dominantBaseline: 'central',
          fontSize: 24, fontWeight: 700, className: 'dshw-wxdial-hum',
        }, Math.round(humidity) + '%'),
      )
    }

    /** 账号右侧：时钟表盘 + 天气表盘。 */
    function WeatherClockChip(props) {
      var t = makeT(props && props.t)
      var dialState = useDialTheme()
      var now = useNow()
      var state = useWeatherSummary()
      var fontState = useFontChoice()
      var data = state.summary.data
      var current = data && data.current
      var isDay = current && current.isDay === 1 ? true
        : current && current.isDay === 0 ? false
        : now.getHours() >= 6 && now.getHours() < 18
      return h('button', {
        type: 'button',
        className: 'dshw-topbar',
        style: { '--dshw-font': fontStack(fontState[0]) },
        title: t('guide.title'),
        'aria-label': t('guide.title'),
        onClick: () => {
          if (typeof props.onToggle !== 'function') return
          props.onToggle()
        },
      },
        h(AnalogClock, { size: 48, now: now, className: 'dshw-clock', dial: dialState[0] }),
        h(WeatherDial, {
          size: 48,
          code: current ? current.weatherCode : null,
          isDay: isDay,
          temperature: current && typeof current.temperature === 'number' ? current.temperature : null,
          humidity: current && typeof current.humidity === 'number' ? current.humidity : null,
        }),
      )
    }

    /** 账号下方三行：天气 / 日期 / 星期时间。 */
    function WeatherInfoChip(props) {
      var t = makeT(props && props.t)
      var state = useWeatherSummary()
      var fontState = useFontChoice()
      var now = useNow()
      var data = state.summary.data
      var current = data && data.current
      var temp = current && typeof current.temperature === 'number'
        ? Math.round(current.temperature) + '℃'
        : '—'
      var humidity = current && typeof current.humidity === 'number'
        ? Math.round(current.humidity) + '%'
        : null
      var cond = current ? codeText(current.weatherCode) : '—'
      var isDay = current && current.isDay === 1 ? true
        : current && current.isDay === 0 ? false
        : now.getHours() >= 6 && now.getHours() < 18
      var theme = themeOf(current ? current.weatherCode : null, isDay)
      var weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
      var clock = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds())
      var dateText = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
      return h('button', {
        type: 'button',
        className: 'dshw-info dshw-t-' + theme.badge,
        style: { '--dshw-font': fontStack(fontState[0]) },
        title: t('guide.title'),
        'aria-label': t('guide.title'),
        onClick: () => {
          if (typeof props.onToggle !== 'function') return
          props.onToggle()
        },
      },
        h('span', { className: 'dshw-line' },
          h('span', { className: 'dshw-sub' }, dateText),
          h('span', { className: 'dshw-sep' }, '·'),
          h('span', { className: 'dshw-sub' }, weekday),
        ),
      )
    }

    // The main-area panel: the full card, centered for the wide surface, with
    // a back-to-chat control. The slot runtime merges the inject face
    // ({ t, onBack }) into the owner props.
    function WeatherMainPanel(props) {
      var t = makeT(props && props.t)
      return h('div', { className: 'dshw-page' },
        typeof props.onBack === 'function' ? h('button', {
          type: 'button',
          className: 'dshw-back',
          onClick: props.onBack,
        }, '← ' + t('back')) : null,
        h(WeatherBody, { t: props && props.t }),
      )
    }

    // The left-rail glyph: the panel row hands the icon { size, active }.
    function WeatherRailGlyph(owner) {
      return h(WeatherGlyph, { size: (owner && owner.size) || 16 })
    }

    // ---------------------------------------------------------------------------
    // Plugin body: register every surface.
    // ---------------------------------------------------------------------------
    var PLUGIN_ID = 'dsh-weather-badge'
    var WEATHER_KIND = 'weather'

    function weatherDefinition(t) {
      return {
        id: PLUGIN_ID,
        kind: WEATHER_KIND,
        title: () => t('type.label'),
        guide: [{
          id: 'weather',
          order: 60,
          title: () => t('guide.title'),
          description: () => t('guide.description'),
          icon: WeatherGlyph,
        }],
      }
    }

    function apply(ctx) {
      var t = ctx.locale.bind(NS)

      // The layout handle drives the badge's toggle and the panel's back
      // button; it is optional, so it rides a scoped inject of its own.
      var layoutRef = { current: null }
      var togglePanel = () => {
        var layout = layoutRef.current
        if (!layout) return
        try {
          var active = layout.panelInfo.getSnapshot().activePanelId
          layout.selectPanel(active === PLUGIN_ID ? null : PLUGIN_ID)
        } catch (error) { /* the layout owner may be mid-swap */ }
      }
      var backToChat = () => {
        var layout = layoutRef.current
        if (!layout) return
        try {
          layout.selectPanel(null)
        } catch (error) { /* non-fatal */ }
      }
      ctx.inject(['layout'], (scope) => {
        layoutRef.current = scope.layout
        ctx.effect(() => () => {
          var layout = layoutRef.current
          layoutRef.current = null
          if (layout && layout.panelInfo && layout.panelInfo.getSnapshot().activePanelId === PLUGIN_ID) {
            try {
              layout.selectPanel(null)
            } catch (error) { /* the layout owner may already be gone */ }
          }
        }, 'dsh-weather-badge: layout handle')
      })

      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-weather-badge: dictionaries')

      // Account row: inject the clock + weather chip right of the account
      // launcher. The shipped trigger row owns no extension seat, so this
      // follows the DOM-injection pattern (same approach the community UI
      // plugins use for the titlebar): find the row, insert beside the
      // account, and re-place after the app re-renders it.
      var CHIP_KEY = '__dshWeatherAccountChipDispose'
      ctx.effect(() => {
        var reactDomClient = null
        try {
          reactDomClient = require('react-dom/client')
        } catch (error) {
          reactDomClient = null
        }
        if (!reactDomClient || typeof MutationObserver === 'undefined') return

        var container = null
        var root = null
        // 账号下方的信息块：整行宽，单独一个宿主。
        var infoHost = null
        var infoRoot = null

        var findAccountRow = () => {
          var rows = document.querySelectorAll('div[class*="triggerRow"]')
          for (var i = 0; i < rows.length; i += 1) {
            var row = rows[i]
            if (row.querySelector('button[aria-haspopup="menu"]')) return row
          }
          return null
        }

        var ensure = () => {
          // Drop hosts left behind by an earlier mount (hot reload, a second
          // window). Only the host carries these classes: the buttons React
          // renders are separate nodes and must never be touched here.
          var hosts = document.querySelectorAll('.dshw-chip-host')
          for (var j = 0; j < hosts.length; j += 1) {
            if (hosts[j] !== container) hosts[j].remove()
          }
          var infos = document.querySelectorAll('.dshw-info-host')
          for (var jj = 0; jj < infos.length; jj += 1) {
            if (infos[jj] !== infoHost) infos[jj].remove()
          }
          var row = findAccountRow()
          if (!row) {
            if (container && container.isConnected) container.remove()
            if (infoHost && infoHost.isConnected) infoHost.remove()
            return
          }
          // Older builds used the button itself as the host; clear those too.
          var legacy = row.querySelectorAll('.dshw-topbar')
          for (var k = 0; k < legacy.length; k += 1) {
            if (!container || !container.contains(legacy[k])) legacy[k].remove()
          }
          // The 56px rail has no room for either block; hide both there.
          var narrow = row.offsetWidth < 150
          if (narrow) {
            if (container) container.style.display = 'none'
            if (infoHost) infoHost.style.display = 'none'
            return
          }
          if (!container) {
            container = document.createElement('div')
            container.className = 'dshw-chip-host'
            root = reactDomClient.createRoot(container)
            root.render(h(WeatherClockChip, { t: t, onToggle: togglePanel }))
          }
          var account = row.querySelector('div[data-inset]') || row.firstElementChild
          if (!container.isConnected || container.parentElement !== row) {
            if (account && account.parentElement === row) account.after(container)
            else row.appendChild(container)
          }
          if (!infoHost) {
            infoHost = document.createElement('div')
            infoHost.className = 'dshw-info-host'
            infoRoot = reactDomClient.createRoot(infoHost)
            infoRoot.render(h(WeatherInfoChip, { t: t, onToggle: togglePanel }))
          }
          // 信息块放在账号行的下一行：只有当行本身是块级容器时才可行，
          // 否则退回行内追加，保证不会把行撑开。
          var hostParent = row.parentElement
          if (hostParent && hostParent !== infoHost && infoHost.parentElement !== hostParent) {
            hostParent.insertBefore(infoHost, row.nextSibling)
          }
          // 表盘是固定 38px 的方块，宽度恒定，不再按剩余宽度反复限位：
          // 那种算法每秒跑一次，会让表盘左右跳动。
          container.style.display = ''
          infoHost.style.display = ''
        }

        var scheduled = false
        var schedule = () => {
          if (scheduled) return
          scheduled = true
          requestAnimationFrame(() => {
            scheduled = false
            ensure()
          })
        }
        // 表盘每秒重绘只改自己宿主内部；这类变更不需要重新布局，过滤掉，
        // 避免每秒触发一次 ensure 造成位置抖动。
        var isOwnMutation = (list) => {
          if (!list.length) return true
          for (var mi = 0; mi < list.length; mi += 1) {
            var node = list[mi].target
            var element = node && node.nodeType === 1 ? node : node && node.parentElement
            if (!element || typeof element.closest !== 'function') return false
            if (!element.closest('.dshw-chip-host') && !element.closest('.dshw-info-host')) return false
          }
          return true
        }
        var observer = new MutationObserver((list) => {
          if (isOwnMutation(list)) return
          schedule()
        })
        observer.observe(document.body, { childList: true, subtree: true })

        // Collapsing/expanding the sidebar only toggles a class on an
        // ancestor, which childList mutations never report — poll the row
        // width so the chip comes back after expanding the rail. ensure()
        // early-returns when everything is already in place, so the idle
        // cost is one querySelectorAll per second.
        var widthPoll = setInterval(ensure, 1000)

        var dispose = () => {
          observer.disconnect()
          clearInterval(widthPoll)
          if (root) {
            root.unmount()
            root = null
          }
          if (container) {
            container.remove()
            container = null
          }
          if (infoRoot) {
            infoRoot.unmount()
            infoRoot = null
          }
          if (infoHost) {
            infoHost.remove()
            infoHost = null
          }
          if (window[CHIP_KEY] === dispose) {
            try {
              delete window[CHIP_KEY]
            } catch (error) {
              window[CHIP_KEY] = undefined
            }
          }
        }

        // A hot reload can leave an earlier instance's observer running, which
        // would keep inserting its own host next to this one. Claim the slot so a
        // fresh mount tears the previous owner down first.
        var previous = window[CHIP_KEY]
        window[CHIP_KEY] = dispose
        if (typeof previous === 'function' && previous !== dispose) {
          try {
            previous()
          } catch (error) { /* the earlier owner may already be gone */ }
        }

        ensure()
        return dispose
      }, 'dsh-weather-badge: account-row chip')

      // Left sidebar: a rail icon plus the main-area panel (plugin-market seats).
      ctx.effect(
        () => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PLUGIN_ID,
          locale: NS,
          inject: () => ({ t: t, onBack: backToChat }),
        }, WeatherMainPanel)),
        'dsh-weather-badge: main panel',
      )
      ctx.effect(
        () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PLUGIN_ID,
          order: 50,
          label: () => t('type.label'),
          locale: NS,
        }, WeatherRailGlyph)),
        'dsh-weather-badge: panel row',
      )

      // Right sidebar: a page-type tab with a guide entry.
      ctx.effect(() => ctx.sidebarRightTabs.register(weatherDefinition(t)), 'dsh-weather-badge: tab type')
      ctx.effect(
        () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: PLUGIN_ID,
          locale: NS,
        }, WeatherBody)),
        'dsh-weather-badge: tab body',
      )
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']
    return module.exports
  },
})
