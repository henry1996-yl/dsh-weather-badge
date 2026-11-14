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
      '.dshw-chip-host{display:inline-flex;align-items:center;flex:none;height:64px}',
      // 账号下方的信息块：整行宽、居中三行文字。
      '.dshw-info-host{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;padding:0 8px 4px;box-sizing:border-box;--dshw-font:inherit}',
      '.dshw-info{display:flex;flex-direction:row;align-items:center;justify-content:center;flex-wrap:nowrap;gap:6px;width:100%;min-width:0;border:none;color:inherit;font:inherit;font-family:var(--dshw-font,inherit);text-align:center;cursor:pointer;padding:2px 6px;border-radius:8px;background:transparent;transition:background .16s;white-space:nowrap;overflow:hidden}',
      '.dshw-topbar{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;flex:none;height:64px;padding:0;box-sizing:border-box;border:none;color:inherit;font:inherit;cursor:pointer;border-radius:8px;background:transparent;transition:background .16s;--dshw-font:inherit}',
      '.dshw-topbar:hover{background:rgba(127,127,127,.12)}',
      '.dshw-info:hover{background:rgba(127,127,127,.12)}',
      '.dshw-t-sun{--dshw-accent:255,176,64}',
      '.dshw-t-night{--dshw-accent:130,140,255}',
      '.dshw-t-cloud{--dshw-accent:150,170,200}',
      '.dshw-t-rain{--dshw-accent:86,148,255}',
      '.dshw-t-snow{--dshw-accent:150,205,255}',
      '.dshw-t-storm{--dshw-accent:178,132,255}',
      '.dshw-t-fog{--dshw-accent:168,180,195}',
      '.dshw-clock{width:64px;height:64px;flex:none;display:block;contain:layout size}',
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
      '.dshw-settings{display:flex;flex-direction:column;gap:7px;margin-top:2px;padding:7px 8px;border-radius:10px;background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.14)}',
      '.dshw-settings-entry{display:inline-flex;align-items:center;gap:4px;flex:none;height:24px;padding:0 9px;margin-left:2px;border-radius:999px;border:1px solid rgba(127,127,127,.28);background:rgba(127,127,127,.14);color:inherit;font:inherit;font-size:11px;line-height:1;cursor:pointer;opacity:.9;transition:background .15s,opacity .15s}',
      '.dshw-settings-entry:hover{background:rgba(127,127,127,.24);opacity:1}',
      '.dshw-settings-entry[data-open="1"]{background:rgba(70,130,200,.22);border-color:rgba(70,130,200,.45);color:inherit}',
      '.dshw-settings-ico{font-size:12px;line-height:1;opacity:.85}',
      '.dshw-settings-head{display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border:1px solid rgba(127,127,127,.22);background:rgba(127,127,127,.12);color:inherit;font:inherit;font-size:12px;cursor:pointer;border-radius:8px;transition:background .15s}',
      '.dshw-settings-head:hover{background:rgba(127,127,127,.2)}',
      '.dshw-settings-title{font-weight:600;letter-spacing:.3px;flex:none}',
      '.dshw-settings-hint{flex:1 1 auto;min-width:0;text-align:right;font-size:10.5px;opacity:.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshw-settings-caret{font-size:12px;line-height:1;opacity:.6;flex:none;transition:transform .15s}',
      '.dshw-settings-caret[data-open="1"]{transform:rotate(180deg)}',
      '.dshw-settings-body{display:flex;flex-direction:column;gap:5px;padding:2px 0 3px}',
      '.dshw-dial-row{display:flex;align-items:center;gap:10px;padding:1px 2px 0}',
      '.dshw-dial-label{font-size:11px;opacity:.55;letter-spacing:.4px;flex:none}',
      '.dshw-dial-swatches{display:flex;gap:8px;flex-wrap:wrap}',
      '.dshw-dial-swatch{display:block;width:34px;height:34px;padding:0;border:none;border-radius:999px;background:transparent;color:inherit;cursor:pointer;opacity:.62;transition:opacity .15s}',
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
      'searchPlaceholder': '搜索城市或乡镇（如 上海 / 塘厦镇）',
      'search': '搜索',
      'searching': '搜索中…',
      'noResults': '没有找到匹配的城市',
      'retry': '重试',
      'locateFailed': '自动定位失败，请搜索城市',
      'pinpoint': '精确定位',
      'pinpointing': '精确定位中…',
      'pinpointDone': '已细化到乡镇 / 街道',
      'pinpointFailed': '系统定位不可用，已按网络位置细化；要精确到某个镇请直接搜索镇名（如 塘厦镇）',
      'ipHint': '按网络位置估计，可能不在实际所在地；点精确定位按钮或搜索镇名',
      'cloud': '云量',
      'humidity': '湿度',
      'precip': '降水概率',
      'feelsLike': '体感',
      'wind': '风',
      'next24h': '未来 24 小时',
      'updated': '更新于 {time}',
      'source': '数据来源 {name}',
      'offline': '离线缓存',
      'today': '今天',
      'tomorrow': '明天',
      'wd0': '周日', 'wd1': '周一', 'wd2': '周二', 'wd3': '周三', 'wd4': '周四', 'wd5': '周五', 'wd6': '周六',
      'settings': '设置',
      'settings.expand': '展开设置',
      'settings.collapse': '收起设置',
      'settings.theme': '表盘主题',
      'settings.font': '字体',
      'settings.time': '时间源',
      'settings.bar': '日期条',
      'settings.wxshape': '天气表盘',
      'settings.clockshape': '时钟表盘',
      'settings.local': '本机',
      'settings.net': '网络',
      'settings.localHint': '使用本机时钟',
      'settings.netHint': '使用网络时间（自动校准本机时钟偏差）',
      'settings.show': '显示',
      'settings.hide': '隐藏',
      'settings.showHint': '显示日期条',
      'settings.hideHint': '隐藏日期条',
      'settings.circle': '圆形',
      'settings.square': '方形',
      'settings.circleWx': '圆形天气表盘',
      'settings.squareWx': '方形天气表盘',
      'settings.circleClock': '圆形时钟表盘',
      'settings.squareClock': '方形时钟表盘',
      'theme.ivory': '白金', 'theme.mist': '雾蓝', 'theme.sand': '暖米',
      'theme.lilac': '薄紫', 'theme.graphite': '石墨', 'theme.jade': '青瓷',
      'font.kai': '楷体', 'font.song': '宋体', 'font.times': 'Times',
      'font.hei': '黑体', 'font.mono': '等宽',
    }

    var EN = {
      'type.label': 'Weather',
      'guide.title': 'Weather forecast',
      'guide.description': 'Current conditions and the next few days',
      'back': 'Back to chat',
      'locating': 'Locating…',
      'loading': 'Loading weather…',
      'refresh': 'Refresh',
      'searchPlaceholder': 'Search a city or town (e.g. Shanghai / 塘厦镇)',
      'search': 'Search',
      'searching': 'Searching…',
      'noResults': 'No matching city',
      'retry': 'Retry',
      'locateFailed': 'Auto-location failed; search a city',
      'pinpoint': 'Precise location',
      'pinpointing': 'Locating precisely…',
      'pinpointDone': 'Refined to town / subdistrict',
      'pinpointFailed': 'System location unavailable; refined by network position. Search a town name (e.g. 塘厦镇) to pin it.',
      'ipHint': 'Estimated from network position and may be off; use precise location or search a town name',
      'cloud': 'Cloud',
      'humidity': 'Humidity',
      'precip': 'Precipitation',
      'feelsLike': 'Feels like',
      'wind': 'Wind',
      'next24h': 'Next 24 hours',
      'updated': 'Updated {time}',
      'source': 'Data by {name}',
      'offline': 'cached',
      'today': 'Today',
      'tomorrow': 'Tomorrow',
      'wd0': 'Sun', 'wd1': 'Mon', 'wd2': 'Tue', 'wd3': 'Wed', 'wd4': 'Thu', 'wd5': 'Fri', 'wd6': 'Sat',
      'settings': 'Settings',
      'settings.expand': 'Expand settings',
      'settings.collapse': 'Collapse settings',
      'settings.theme': 'Dial theme',
      'settings.font': 'Font',
      'settings.time': 'Time source',
      'settings.bar': 'Date bar',
      'settings.wxshape': 'Weather dial',
      'settings.clockshape': 'Clock dial',
      'settings.local': 'Local',
      'settings.net': 'Network',
      'settings.localHint': 'Use the local clock',
      'settings.netHint': 'Use network time (corrects local clock drift)',
      'settings.show': 'Show',
      'settings.hide': 'Hide',
      'settings.showHint': 'Show the date bar',
      'settings.hideHint': 'Hide the date bar',
      'settings.circle': 'Circle',
      'settings.square': 'Square',
      'settings.circleWx': 'Circular weather dial',
      'settings.squareWx': 'Square weather dial',
      'settings.circleClock': 'Circular clock dial',
      'settings.squareClock': 'Square clock dial',
      'theme.ivory': 'Ivory', 'theme.mist': 'Mist', 'theme.sand': 'Sand',
      'theme.lilac': 'Lilac', 'theme.graphite': 'Graphite', 'theme.jade': 'Jade',
      'font.kai': 'Kai', 'font.song': 'Song', 'font.times': 'Times',
      'font.hei': 'Hei', 'font.mono': 'Mono',
    }


    /** 当前界面是否中文：用于日期与星期的排版，两种语言各写一套。 */
    function localeIsZh(t) {
      try {
        // 平台没有直接暴露当前语言，用一条已知译文的实际结果反推。
        return t('back') !== EN['back']
      } catch (error) {
        return true
      }
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

    /** 搜城市：Open-Meteo 地理编码优先，失败或空结果再退 Photon。 */
    function geocodeOpenMeteo(name, count) {
      var url = 'https://geocoding-api.open-meteo.com/v1/search?name='
        + encodeURIComponent(name) + '&count=' + (count || 5) + '&language=zh&format=json'
      return fetchJson(url, 10000).then((data) => {
        var results = data && Array.isArray(data.results) ? data.results : []
        return results.map((hit) => ({
          name: String(hit.name || ''),
          admin1: typeof hit.admin1 === 'string' ? hit.admin1 : '',
          admin2: typeof hit.admin2 === 'string' ? hit.admin2 : '',
          country: typeof hit.country === 'string' ? hit.country : '',
          latitude: hit.latitude,
          longitude: hit.longitude,
          kind: typeof hit.feature_code === 'string' ? hit.feature_code : '',
          population: typeof hit.population === 'number' ? hit.population : 0,
        })).filter((hit) => hit.name && typeof hit.latitude === 'number' && typeof hit.longitude === 'number')
      })
    }

    /** 备用地理编码：Photon（komoot），CORS 开放，中文地名按 OSM 原名返回。 */
    function geocodePhoton(name, count) {
      var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(name) + '&limit=' + (count || 5)
      return fetchJson(url, 10000).then((data) => {
        var features = data && Array.isArray(data.features) ? data.features : []
        return features.map((feature) => {
          var props = (feature && feature.properties) || {}
          var xy = (feature && feature.geometry && feature.geometry.coordinates) || []
          return {
            name: String(props.name || props.city || props.county || ''),
            admin1: typeof props.state === 'string' ? props.state : '',
            admin2: String(props.city || props.county || props.district || ''),
            country: typeof props.country === 'string' ? props.country : '',
            latitude: Number(xy[1]),
            longitude: Number(xy[0]),
            kind: String(props.osm_value || props.type || ''),
            population: 0,
          }
        }).filter((hit) => hit.name && isFinite(hit.latitude) && isFinite(hit.longitude))
      })
    }

    /** 把「上级地名 + 本级地名」连写拆成地理编码能认的候选，如「梅州兴宁市」→「梅州 兴宁市」。 */
    function geocodeQualifiedVariants(name) {
      var out = []
      var push = function (value) {
        var v = String(value || '').trim()
        if (v.length >= 2 && v !== name && out.indexOf(v) < 0) out.push(v)
      }
      if (!/[\u3400-\u9fff]/.test(name) || name.length < 4) return out
      // 在 2~4 字处插空格，保留「上级 + 本级」上下文，Photon 命中率最高。
      for (var k = 2; k <= 4 && k <= name.length - 2; k += 1) {
        push(name.slice(0, k) + ' ' + name.slice(k))
      }
      // 再退到尾部地名与去掉行政后缀的短名。
      push(name.slice(-3))
      push(name.replace(/(省|市|区|县|镇|乡|街道)+$/, ''))
      push(name.slice(-2))
      return out.slice(0, 5)
    }

    // 行政级别权重：区/县级市与镇比普通地物更可能是用户想找的地名。
    var ADMIN_RANK = { PPLA: 5, PPLA2: 5, PPLA3: 4, PPLA4: 4, PPL: 3, county: 4, city: 4, town: 3, village: 2, hamlet: 1, state: 3, district: 3 }

    /** 把两家源的结果合并去重：名字完全匹配优先，其次行政级别与人口。 */
    function mergeHits(hits, keyword) {
      var seen = {}
      var out = []
      for (var i = 0; i < hits.length; i += 1) {
        var hit = hits[i]
        if (!hit) continue
        // 同名同坐标视为同一条，避免两个源重复展示。
        var key = hit.name + '@' + Math.round(hit.latitude * 100) + ',' + Math.round(hit.longitude * 100)
        if (seen[key]) continue
        seen[key] = true
        out.push(hit)
      }
      // 名字匹配分：4 带行政后缀的全称（兴宁市、兴宁区）最像用户要找的地名，3 完全同名，2 前缀，1 包含。
      var nameScoreOf = function (name) {
        if (name === keyword) return 3
        if (name.indexOf(keyword) === 0 && /^(省|市|区|县|镇|乡|街道)$/.test(name.slice(keyword.length))) return 4
        var bare = keyword.replace(/(省|市|区|县|镇|乡|街道)+$/, '')
        if (name.indexOf(bare) === 0) return 2
        return name.indexOf(bare) >= 0 ? 1 : 0
      }
      out.sort(function (a, b) {
        var sa = nameScoreOf(a.name)
        var sb = nameScoreOf(b.name)
        if (sa !== sb) return sb - sa
        var ra = ADMIN_RANK[a.kind] || 0
        var rb = ADMIN_RANK[b.kind] || 0
        if (ra !== rb) return rb - ra
        return (b.population || 0) - (a.population || 0)
      })
      return out
    }

    // 输入即搜的防抖间隔：太短会把每个字都发出去，太长会让用户觉得卡。
    var LIVE_SEARCH_DELAY_MS = 350

    /** 搜城市：两家源并行查询并合并，任一家为空都能拿到另一家的结果。 */
    function geocode(name, count) {
      var tryOnce = function (query) {
        return Promise.all([
          geocodeOpenMeteo(query, count).catch(() => []),
          geocodePhoton(query, count).catch(() => []),
        ]).then((pair) => mergeHits(pair[0].concat(pair[1]), query))
      }
      return tryOnce(name).then((hits) => {
        if (hits.length > 0) return hits
        // 两家都没结果时才拆词重试，避免正常查询多打请求。
        var variants = geocodeQualifiedVariants(name)
        var i = 0
        var next = function () {
          if (i >= variants.length) return Promise.resolve([])
          return tryOnce(variants[i++]).then((more) => (more.length > 0 ? more : next()))
        }
        return next()
      })
    }

    // 依次尝试多家 IP 定位服务：任何一家挂了或被限流就换下一家，全部失败才算定位失败。
    // 每家返回 lat/lon 的字段名都不同，用 map 抽成统一结构。
    var IP_LOCATORS = [
      {
        url: 'https://ipwho.is/',
        read: (data) => (data && data.success !== false && typeof data.latitude === 'number'
          ? { name: data.city || data.region || data.country, admin1: data.region, country: data.country, latitude: data.latitude, longitude: data.longitude }
          : null),
      },
      {
        url: 'https://get.geojs.io/v1/ip/geo.json',
        read: (data) => (data && data.latitude !== undefined
          ? { name: data.city || data.region || data.country, admin1: data.region, country: data.country, latitude: Number(data.latitude), longitude: Number(data.longitude) }
          : null),
      },
      {
        url: 'https://ipinfo.io/json',
        read: (data) => {
          if (!data || typeof data.loc !== 'string') return null
          var parts = data.loc.split(',')
          return { name: data.city || data.region || data.country, admin1: data.region, country: data.country, latitude: Number(parts[0]), longitude: Number(parts[1]) }
        },
      },
      {
        url: 'https://ipapi.co/json/',
        read: (data) => (data && !data.error && typeof data.latitude === 'number'
          ? { name: data.city || data.region || data.country_name, admin1: data.region, country: data.country_name, latitude: data.latitude, longitude: data.longitude }
          : null),
      },
    ]

    /** 依次尝试各家 IP 定位服务，第一个拿到座标的直接返回。 */
    function locateByIpFrom(index) {
      var i = index || 0
      if (i >= IP_LOCATORS.length) return Promise.reject(new Error('all IP locators failed'))
      var locator = IP_LOCATORS[i]
      return fetchJson(locator.url, 6000).then((data) => {
        var hit = locator.read(data)
        if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number'
          || isNaN(hit.latitude) || isNaN(hit.longitude)) {
          throw new Error(locator.url + ' gave no coordinates')
        }
        return {
          name: String(hit.name || ''),
          admin1: typeof hit.admin1 === 'string' ? hit.admin1 : '',
          country: typeof hit.country === 'string' ? hit.country : '',
          latitude: hit.latitude,
          longitude: hit.longitude,
          via: 'ip',
        }
      }).catch(() => locateByIpFrom(i + 1))
    }

    function locateByIp() {
      return locateByIpFrom(0).then(localizeLocation).then(refineLocation)
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
          admin2: best.admin2 || location.admin2,
          country: best.country || location.country,
          latitude: best.latitude,
          longitude: best.longitude,
          via: location.via,
        }
      }).catch(() => location)
    }

    var REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

    /** 反向地理编码：把座标换成中文的乡镇/街道、市、省、国家（BigDataCloud，CORS 开放）。 */
    function reverseGeocode(latitude, longitude) {
      var url = REVERSE_URL + '?latitude=' + encodeURIComponent(latitude)
        + '&longitude=' + encodeURIComponent(longitude) + '&localityLanguage=zh'
      return fetchJson(url, 8000).then((data) => {
        if (!data || typeof data.locality !== 'string' || !data.locality) return null
        return {
          locality: data.locality,
          city: typeof data.city === 'string' ? data.city : '',
          subdivision: typeof data.principalSubdivision === 'string' ? data.principalSubdivision : '',
          country: data.countryName === '中华人民共和国' ? '中国'
            : (typeof data.countryName === 'string' ? data.countryName : ''),
        }
      }).catch(() => null)
    }

    /** 把市级地名细化到乡镇/街道；反向服务拿不到结果时原样返回同一个对象。 */
    function refineLocation(location) {
      if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        return Promise.resolve(location)
      }
      return reverseGeocode(location.latitude, location.longitude).then((hit) => {
        if (!hit || !hit.locality || hit.locality === location.name) return location
        return {
          name: hit.locality,
          admin1: hit.subdivision || location.admin1,
          admin2: hit.city && hit.city !== hit.locality ? hit.city : location.admin2,
          country: hit.country || location.country,
          latitude: location.latitude,
          longitude: location.longitude,
          via: location.via,
        }
      }).catch(() => location)
    }

    // wttr.in 用 WWO 天气码，和 Open-Meteo 的 WMO 码不是一套；
    // 这里只映射到本插件认识的 8 个大类，够撑住图标与文案。
    var WWO_TO_WMO = {
      113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 48,
      176: 80, 179: 85, 182: 56, 185: 56, 200: 95,
      227: 75, 230: 75,
      263: 51, 266: 51, 281: 56, 284: 56,
      293: 61, 296: 61, 299: 63, 302: 63, 305: 65, 308: 65,
      311: 66, 314: 67, 317: 66, 320: 71,
      323: 71, 326: 71, 329: 73, 332: 73, 335: 75, 338: 75,
      350: 77, 353: 80, 356: 81, 359: 82,
      362: 85, 365: 85, 368: 86, 371: 86,
      374: 77, 377: 77, 386: 95, 389: 99, 392: 95, 395: 95,
    }
    function wmoOfWwo(code) {
      var mapped = WWO_TO_WMO[code]
      return typeof mapped === "number" ? mapped : 3
    }

    /** wttr.in 的 3 小时一档时间戳（"0"、"300"）拼成 ISO 字符串。 */
    function wttrStamp(date, hhmm) {
      var raw = String(hhmm || "0")
      while (raw.length < 4) raw = "0" + raw
      return String(date) + "T" + raw.slice(0, 2) + ":00"
    }

    /**
     * 备用数据源：本机到 Open-Meteo 机房不通时退到 wttr.in。
     * 只给 3 天、3 小时一档，字段也比 Open-Meteo 少，
     * 所以能填的填、填不了的留 null，让界面自己省略。
     */
    function fetchForecastWttr(location) {
      var lat = Number(location.latitude).toFixed(3)
      var lon = Number(location.longitude).toFixed(3)
      var url = "https://wttr.in/" + lat + "," + lon + "?format=j1"
      return fetchJson(url, 12000).then((data) => {
        var cc = data && Array.isArray(data.current_condition) ? data.current_condition[0] : null
        var days = data && Array.isArray(data.weather) ? data.weather : []
        if (!cc || days.length === 0) throw new Error("unexpected wttr payload")
        var now = new Date()
        var cutoff = now.getTime() - 60 * 60 * 1000
        var hours = []
        for (var i = 0; i < days.length; i += 1) {
          var list = Array.isArray(days[i].hourly) ? days[i].hourly : []
          for (var j = 0; j < list.length; j += 1) {
            var stamp = wttrStamp(days[i].date, list[j].time)
            var at = new Date(stamp + ":00").getTime()
            var temp = Number(list[j].tempC)
            if (!(at >= cutoff) || !isFinite(temp)) continue
            hours.push({ time: stamp, temperature: temp })
          }
        }
        if (hours.length === 0) throw new Error("wttr gave no hourly data")
        var daily = []
        for (var d = 0; d < days.length; d += 1) {
          var rows = Array.isArray(days[d].hourly) ? days[d].hourly : []
          var worst = 0
          for (var r = 0; r < rows.length; r += 1) {
            var chance = Number(rows[r].chanceofrain)
            if (isFinite(chance) && chance > worst) worst = chance
          }
          // 当天的代表天气码取正午那一档，比取首档更接近白天的观感。
          var noon = null
          for (var n = 0; n < rows.length; n += 1) {
            if (String(rows[n].time) === "1200") { noon = rows[n]; break }
          }
          var pick = noon || rows[0] || null
          daily.push({
            date: String(days[d].date),
            weatherCode: pick ? wmoOfWwo(Number(pick.weatherCode)) : 3,
            tempMax: isFinite(Number(days[d].maxtempC)) ? Number(days[d].maxtempC) : null,
            tempMin: isFinite(Number(days[d].mintempC)) ? Number(days[d].mintempC) : null,
            precipitationProbability: worst,
          })
        }
        var hour = now.getHours()
        return {
          location: location,
          current: {
            time: days[0].date + "T" + pad2(now.getHours()) + ":" + pad2(now.getMinutes()),
            temperature: Number(cc.temp_C),
            apparentTemperature: Number(cc.FeelsLikeC),
            humidity: Number(cc.humidity),
            cloudCover: isFinite(Number(cc.cloudcover)) ? Number(cc.cloudcover) : null,
            weatherCode: cloudAdjustedCode(wmoOfWwo(Number(cc.weatherCode)), Number(cc.cloudcover)),
            windSpeed: Number(cc.windspeedKmph),
            isDay: hour >= 6 && hour < 18 ? 1 : 0,
          },
          hours: hours,
          daily: daily,
          fetchedAt: Date.now(),
          source: "wttr",
        }
      })
    }
    // ---------------------------------------------------------------------------
    // 备用源 2：MET Norway（api.met.no）。全球覆盖、免 Key、CORS 开放。
    // 只给逐小时序列，日预报按本地日期自行归并。数据许可 CC-BY 4.0。
    // ---------------------------------------------------------------------------
    /** 云量修正：WMO 码只按降水/能见度分档，晴/多云类用云量改到更贴近体感的档位。 */
    function cloudAdjustedCode(code, cloudCover) {
      if (typeof code !== 'number' || typeof cloudCover !== 'number' || !isFinite(cloudCover)) return code
      // 降水/雾/雪/雷等码保持原样，只在晴(0)/基本晴(1)/多云(2)/阴(3) 之间纠正。
      if (code !== 0 && code !== 1 && code !== 2 && code !== 3) return code
      if (cloudCover >= 85) return 3
      if (cloudCover >= 40) return 2
      if (cloudCover >= 15) return 1
      return code
    }

    var METNO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

    /** met.no 的 symbol_code 归到本插件认识的 WMO 大类。 */
    function wmoOfMetno(symbol) {
      var raw = String(symbol || '').toLowerCase().replace(/_(day|night|polartwilight)$/, '')
      if (raw === 'clearsky') return 0
      if (raw === 'fair') return 1
      if (raw === 'partlycloudy') return 2
      if (raw === 'cloudy') return 3
      if (raw === 'fog') return 45
      if (raw.indexOf('thunder') >= 0) return 95
      if (raw.indexOf('snow') >= 0 || raw.indexOf('sleet') >= 0) {
        if (raw.indexOf('heavy') >= 0) return 75
        if (raw.indexOf('light') >= 0) return 71
        return 73
      }
      if (raw.indexOf('rain') >= 0) {
        if (raw.indexOf('heavy') >= 0) return 65
        if (raw.indexOf('light') >= 0) return 61
        return 63
      }
      return 3
    }

    /** 毫秒时间戳按本机时区拼成不带时区的 ISO 串，和别的源保持同一格式。 */
    function localStamp(ms) {
      var d = new Date(ms)
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
        + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    }

    /**
     * 备用数据源：MET Norway。逐小时序列自带温度、湿度、风与天气码，
     * 缺体感温度（填 null），昼夜判断优先用 symbol 的 _day/_night 后缀。
     */
    function fetchForecastMetno(location) {
      var url = METNO_URL + '?lat=' + Number(location.latitude).toFixed(4)
        + '&lon=' + Number(location.longitude).toFixed(4)
      return fetch(url, {
        headers: { 'User-Agent': 'dsh-weather-badge/1.3.1 github.com/henry1996-yl/dsh-weather-badge' },
        signal: AbortSignal.timeout(12000),
      }).then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      }).then((data) => {
        var series = data && data.properties && Array.isArray(data.properties.timeseries)
          ? data.properties.timeseries : []
        if (series.length === 0) throw new Error('unexpected met.no payload')
        var now = Date.now()
        var rows = []
        for (var i = 0; i < series.length; i += 1) {
          var at = new Date(series[i].time).getTime()
          var details = (series[i].data && series[i].data.instant && series[i].data.instant.details) || {}
          if (!isFinite(at) || typeof details.air_temperature !== 'number') continue
          var block = series[i].data.next_1_hours || series[i].data.next_6_hours || null
          var symbol = block && block.summary ? block.summary.symbol_code : ''
          // met.no 只给降水量（mm），按 1mm≈20% 的概率粗换成百分比。
          var amount = block && block.details && typeof block.details.precipitation_amount === 'number'
            ? block.details.precipitation_amount : 0
          rows.push({ at: at, details: details, symbol: String(symbol || ''), precip: amount, cloud: typeof details.cloud_area_fraction === 'number' ? details.cloud_area_fraction : null })
        }
        if (rows.length === 0) throw new Error('met.no gave no usable rows')
        // 当前值取最近的一档（序列从整点开始，第一个不早于现在的就是它）。
        var current = rows[0]
        for (var c = 0; c < rows.length; c += 1) {
          if (rows[c].at >= now - 30 * 60 * 1000) { current = rows[c]; break }
        }
        var hours = []
        for (var h = 0; h < rows.length && hours.length < 24; h += 1) {
          if (rows[h].at + 30 * 60 * 1000 < now) continue
          hours.push({ time: localStamp(rows[h].at), temperature: rows[h].details.air_temperature })
        }
        // 按本地日期归并：最高/最低取全天极值，代表天气码取正午那一档。
        var byDay = {}
        var order = []
        for (var d = 0; d < rows.length; d += 1) {
          var key = localStamp(rows[d].at).slice(0, 10)
          if (!byDay[key]) { byDay[key] = { temps: [], noon: null, noonGap: 99, precip: 0 }; order.push(key) }
          var bucket = byDay[key]
          bucket.temps.push(rows[d].details.air_temperature)
          if (rows[d].precip > bucket.precip) bucket.precip = rows[d].precip
          var gap = Math.abs(Number(localStamp(rows[d].at).slice(11, 13)) - 12)
          if (gap < bucket.noonGap) { bucket.noonGap = gap; bucket.noon = rows[d] }
        }
        var daily = []
        for (var k = 0; k < order.length && daily.length < 10; k += 1) {
          var day = byDay[order[k]]
          daily.push({
            date: order[k],
            weatherCode: day.noon ? wmoOfMetno(day.noon.symbol) : 3,
            tempMax: Math.max.apply(null, day.temps),
            tempMin: Math.min.apply(null, day.temps),
            precipitationProbability: Math.min(100, Math.round(day.precip * 20)),
          })
        }
        var hour = new Date(now).getHours()
        var isDay = current.symbol.indexOf('night') >= 0 ? 0
          : current.symbol.indexOf('day') >= 0 ? 1
            : (hour >= 6 && hour < 18 ? 1 : 0)
        return {
          location: location,
          current: {
            time: localStamp(current.at),
            temperature: current.details.air_temperature,
            apparentTemperature: null,
            humidity: typeof current.details.relative_humidity === 'number' ? current.details.relative_humidity : null,
            cloudCover: current.cloud,
            weatherCode: cloudAdjustedCode(wmoOfMetno(current.symbol), current.cloud),
            windSpeed: typeof current.details.wind_speed === 'number' ? current.details.wind_speed * 3.6 : null,
            isDay: isDay,
          },
          hours: hours,
          daily: daily,
          fetchedAt: Date.now(),
          source: 'metno',
        }
      })
    }

    function fetchForecastOpenMeteo(location) {
      var params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,cloud_cover',
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
            cloudCover: typeof data.current.cloud_cover === 'number' ? data.current.cloud_cover : null,
            weatherCode: cloudAdjustedCode(data.current.weather_code, data.current.cloud_cover),
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
          source: 'open-meteo',
        }
      })
    }

    /**
     * 数据源健康表：某个源刚失败过就先冷却一段时间，避免每次都卡在超时上。
     * 冷却结束后自动解除，恢复重试。
     */
    var SOURCE_COOLDOWN_MS = 10 * 60 * 1000
    var SOURCE_ORDER = ['open-meteo', 'metno', 'wttr']
    // 界面上展示给用户的源名。MET Norway 用 CC-BY 4.0，必须署名。
    var SOURCE_LABELS = {
      'open-meteo': 'Open-Meteo',
      metno: 'MET Norway',
      wttr: 'wttr.in',
    }
    var sourceHealth = {}

    function sourceReady(id) {
      var until = sourceHealth[id]
      return !(typeof until === 'number' && until > Date.now())
    }
    function markSourceOk(id) { sourceHealth[id] = 0 }
    function markSourceFailed(id) { sourceHealth[id] = Date.now() + SOURCE_COOLDOWN_MS }

    /** 依次尝试可用的源，第一个成功即返回；全部失败才抛错。 */
    function fetchForecastFrom(index, location) {
      var i = index || 0
      while (i < SOURCE_ORDER.length && !sourceReady(SOURCE_ORDER[i])) i += 1
      if (i >= SOURCE_ORDER.length) return Promise.reject(new Error('all forecast sources failed'))
      var id = SOURCE_ORDER[i]
      var run = id === 'open-meteo' ? fetchForecastOpenMeteo
        : id === 'metno' ? fetchForecastMetno
          : fetchForecastWttr
      return run(location).then((data) => {
        markSourceOk(id)
        data.source = id
        return data
      }).catch(() => {
        markSourceFailed(id)
        return fetchForecastFrom(i + 1, location)
      })
    }

    /**
     * 统一取数入口：Open-Meteo → MET Norway → wttr.in，三级自动切换。
     * 每个失败过的源冷却 10 分钟，避免反复等超时。
     */
    function fetchForecast(location) {
      return fetchForecastFrom(0, location)
    }

    // One shared cache: the top-bar badge, the left panel, and the right tab
    // all hit the same in-flight promise within its TTL instead of
    // triple-fetching.
    var CACHE_TTL_MS = 5 * 60 * 1000
    var forecastCache = { key: null, promise: null, at: 0 }

    // 最近一次成功的数据落盘：三家源全挂时至少还能显示上次的温度，
    // 而不是把整块界面清空成占位符。
    var LS_LAST = 'dsh-weather-badge.last.v1'

    function saveLastForecast(key, data) {
      try {
        localStorage.setItem(LS_LAST, JSON.stringify({ key: key, at: Date.now(), data: data }))
      } catch (error) { /* storage may be unavailable or full */ }
    }

    function loadLastForecast(key) {
      try {
        var raw = localStorage.getItem(LS_LAST)
        if (!raw) return null
        var saved = JSON.parse(raw)
        if (!saved || saved.key !== key || !saved.data) return null
        return saved.data
      } catch (error) {
        return null
      }
    }

    function fetchForecastCached(location, force) {
      var key = location.latitude + ',' + location.longitude
      var fresh = forecastCache.promise && forecastCache.key === key && Date.now() - forecastCache.at < CACHE_TTL_MS
      if (!force && fresh) return forecastCache.promise
      forecastCache.key = key
      forecastCache.at = Date.now()
      forecastCache.promise = fetchForecast(location).then((data) => {
        saveLastForecast(key, data)
        return data
      }).catch((error) => {
        forecastCache.promise = null
        // 全部源都失败：退回上次成功的数据，并标成离线缓存。
        var last = loadLastForecast(key)
        if (last) {
          var fallback = Object.assign({}, last, { stale: true, staleReason: error && error.message ? error.message : String(error) })
          return fallback
        }
        throw error
      })
      return forecastCache.promise
    }

    function locationLabel(location) {
      var parts = [location.name]
      var seen = [location.name]
      if (location.admin2 && seen.indexOf(location.admin2) < 0) { parts.push(location.admin2); seen.push(location.admin2) }
      if (location.admin1 && seen.indexOf(location.admin1) < 0) { parts.push(location.admin1); seen.push(location.admin1) }
      if (location.country && seen.indexOf(location.country) < 0) parts.push(location.country)
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

    function PinGlyph() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z' }),
        h('circle', { cx: '12', cy: '10', r: '2.4' }),
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
      var infoState = useInfoVisible()
      var shapeState = useWxShape()
      var clockShapeState = useClockShape()
      var netTimeState = useNetTime()
      var settingsOpen = useSettingsOpen()

      // Mutable state lives in refs; `tick` only triggers re-renders.
      var cityRef = react.useRef(loadSavedCity())
      var weatherRef = react.useRef({ status: 'idle', data: null, error: null })
      var locatingRef = react.useRef(cityRef.current === null)
      var locateErrorRef = react.useRef(null)
      var pinpointingRef = react.useRef(false)
      var pinpointNoteRef = react.useRef(null)
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
      var liveTimerRef = react.useRef(null)

      // 输入即搜：停手 350ms 自动查一次，回车仍然立即搜索。
      react.useEffect(() => {
        var text = query.trim()
        if (liveTimerRef.current) { clearTimeout(liveTimerRef.current); liveTimerRef.current = null }
        if (!text) {
          setSearch({ status: 'idle', results: null })
          return undefined
        }
        liveTimerRef.current = setTimeout(() => {
          liveTimerRef.current = null
          setSearch({ status: 'searching', results: null })
          geocode(text, 8).then((results) => {
            setSearch({ status: results.length > 0 ? 'results' : 'empty', results: results })
          }).catch((error) => {
            setSearch({ status: 'error', results: null, error: error && error.message ? error.message : String(error) })
          })
        }, LIVE_SEARCH_DELAY_MS)
        return () => {
          if (liveTimerRef.current) { clearTimeout(liveTimerRef.current); liveTimerRef.current = null }
        }
      }, [query])

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

      // 精确定位：优先用系统定位拿到乡镇/街道级座标，再反向地理编码取中文地名；
      // 系统定位不可用时退回到已有座标的反向细化，并提示用户可直接搜索镇名。
      var pinpoint = react.useCallback(() => {
        pinpointingRef.current = true
        pinpointNoteRef.current = null
        forceUpdate()
        var finish = (location, note) => {
          pinpointingRef.current = false
          pinpointNoteRef.current = note
          chooseCity(location)
          forceUpdate()
        }
        var fallback = () => {
          var base = cityRef.current
          if (!base) { locate(); return }
          refineLocation(base).then((next) => {
            finish(next, next === base ? t('pinpointFailed') : t('pinpointDone'))
          }).catch(() => locate())
        }
        var geo = window.navigator && window.navigator.geolocation
        if (!geo || typeof geo.getCurrentPosition !== 'function') { fallback(); return }
        var settled = false
        var timer = setTimeout(() => { if (!settled) { settled = true; fallback() } }, 11000)
        var onOk = (position) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          var coords = position && position.coords
          if (!coords || typeof coords.latitude !== 'number') { fallback(); return }
          var base = {
            name: (cityRef.current && cityRef.current.name) || '',
            admin1: (cityRef.current && cityRef.current.admin1) || '',
            country: (cityRef.current && cityRef.current.country) || '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            via: 'geo',
          }
          refineLocation(base).then((next) => {
            if (next === base) { fallback(); return }
            finish(next, t('pinpointDone'))
          }).catch(() => fallback())
        }
        var onErr = () => { if (!settled) { settled = true; clearTimeout(timer); fallback() } }
        try {
          geo.getCurrentPosition(onOk, onErr, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
        } catch (error) { onErr() }
      }, [chooseCity, forceUpdate, locate, t])

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
          if (!next) return
          var same = cityRef.current && next.latitude === cityRef.current.latitude && next.longitude === cityRef.current.longitude
          cityRef.current = next
          if (!same) loadWeather(next, false)
          else forceUpdate()
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
        if (liveTimerRef.current) { clearTimeout(liveTimerRef.current); liveTimerRef.current = null }
        setSearch({ status: 'searching', results: null })
        geocode(name, 8).then((results) => {
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
          city && city.via === 'ip' ? h('span', { className: 'dshw-cityhint' }, 'IP')
            : city && city.via === 'geo' ? h('span', { className: 'dshw-cityhint' }, 'GPS') : null,
        ),
        h('button', {
          key: 'settings',
          type: 'button',
          className: 'dshw-settings-entry',
          'data-open': settingsOpen[0] ? '1' : '0',
          title: settingsOpen[0] ? t('settings.collapse') : t('settings.expand'),
          'aria-label': t('settings'),
          'aria-expanded': settingsOpen[0] ? 'true' : 'false',
          onClick: () => settingsOpen[1](!settingsOpen[0]),
        },
          h('span', { key: 'ico', className: 'dshw-settings-ico' }, '\u2699'),
          h('span', { key: 'txt' }, t('settings')),
        ),
        h('button', {
          key: 'pinpoint',
          type: 'button',
          className: 'dshw-iconbtn',
          title: t('pinpoint'),
          'aria-label': t('pinpoint'),
          disabled: pinpointingRef.current,
          onClick: pinpoint,
        }, h(PinGlyph)),
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

      // Settings drawer: every switch is collected here, then mounted
      // behind one collapsible header so the panel stays short.
      var settingsRows = []

      // Dial theme picker: six themes, shared with the account chip.
      settingsRows.push(h('div', { key: 'dial', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.theme')),
        h('div', { className: 'dshw-dial-swatches' },
          DIAL_THEMES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: 'dshw-dial-swatch',
            'data-active': item.id === dialState[0] ? '1' : '0',
            title: t('theme.' + item.id),
            'aria-label': t('theme.' + item.id),
            onClick: () => dialState[1](item.id),
          }, h(DialSwatch, { id: item.id, shape: clockShapeState[0] }))),
        ),
      ))

      // Font picker: same five stacks, shared with the account chip.
      settingsRows.push(h('div', { key: 'font', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.font')),
        h('div', { className: 'dshw-dial-swatches' },
          FONT_CHOICES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: 'dshw-font',
            style: { fontFamily: item.stack },
            'data-active': item.id === fontState[0] ? '1' : '0',
            title: t('font.' + item.id),
            'aria-label': t('font.' + item.id),
            onClick: () => fontState[1](item.id),
          }, t('font.' + item.id))),
        ),
      ))

      // Time source switch: local clock or network time.
      settingsRows.push(h('div', { key: 'nettime', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.time')),
        h('div', { className: 'dshw-dial-swatches' },
          h('button', {
            key: 'local',
            type: 'button',
            className: 'dshw-font',
            'data-active': netTimeState[0] ? '0' : '1',
            title: t('settings.localHint'),
            onClick: () => netTimeState[1](false),
          }, t('settings.local')),
          h('button', {
            key: 'net',
            type: 'button',
            className: 'dshw-font',
            'data-active': netTimeState[0] ? '1' : '0',
            title: t('settings.netHint'),
            onClick: () => netTimeState[1](true),
          }, t('settings.net')),
        ),
      ))

      // Date-bar switch: hide the whole line under the account row.
      settingsRows.push(h('div', { key: 'info', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.bar')),
        h('div', { className: 'dshw-dial-swatches' },
          h('button', {
            key: 'on',
            type: 'button',
            className: 'dshw-font',
            'data-active': infoState[0] ? '1' : '0',
            title: t('settings.showHint'),
            onClick: () => infoState[1](true),
          }, t('settings.show')),
          h('button', {
            key: 'off',
            type: 'button',
            className: 'dshw-font',
            'data-active': infoState[0] ? '0' : '1',
            title: t('settings.hideHint'),
            onClick: () => infoState[1](false),
          }, t('settings.hide')),
        ),
      ))

      // Weather dial outline switch: circle or square.
      settingsRows.push(h('div', { key: 'wxshape', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.wxshape')),
        h('div', { className: 'dshw-dial-swatches' },
          h('button', {
            key: 'circle',
            type: 'button',
            className: 'dshw-font',
            'data-active': shapeState[0] === 'circle' ? '1' : '0',
            title: t('settings.circleWx'),
            onClick: () => shapeState[1]('circle'),
          }, t('settings.circle')),
          h('button', {
            key: 'square',
            type: 'button',
            className: 'dshw-font',
            'data-active': shapeState[0] === 'square' ? '1' : '0',
            title: t('settings.squareWx'),
            onClick: () => shapeState[1]('square'),
          }, t('settings.square')),
        ),
      ))

      // Clock dial outline switch: circle or square.
      settingsRows.push(h('div', { key: 'clockshape', className: 'dshw-dial-row' },
        h('span', { className: 'dshw-dial-label' }, t('settings.clockshape')),
        h('div', { className: 'dshw-dial-swatches' },
          h('button', {
            key: 'circle',
            type: 'button',
            className: 'dshw-font',
            'data-active': clockShapeState[0] === 'circle' ? '1' : '0',
            title: t('settings.circleClock'),
            onClick: () => clockShapeState[1]('circle'),
          }, t('settings.circle')),
          h('button', {
            key: 'square',
            type: 'button',
            className: 'dshw-font',
            'data-active': clockShapeState[0] === 'square' ? '1' : '0',
            title: t('settings.squareClock'),
            onClick: () => clockShapeState[1]('square'),
          }, t('settings.square')),
        ),
      ))

      // The drawer itself: a header button plus the rows, only mounted when open.
      children.push(settingsOpen[0]
        ? h('div', { key: 'settings', className: 'dshw-settings' }, settingsRows)
        : null)

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
              admin2: result.admin2,
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

      if (pinpointingRef.current) {
        children.push(h('div', { key: 'pinpointing', className: 'dshw-status' }, t('pinpointing')))
      } else if (pinpointNoteRef.current) {
        children.push(h('div', { key: 'pinpointnote', className: 'dshw-status' }, pinpointNoteRef.current))
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
        if (typeof current.cloudCover === 'number') chips.push(t('cloud') + ' ' + Math.round(current.cloudCover) + '%')
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
        var sourceName = SOURCE_LABELS[data.source] || SOURCE_LABELS['open-meteo']
        var footText = t('updated', { time: clock }) + ' · ' + t('source', { name: sourceName })
        if (typeof current.cloudCover === 'number') footText = footText + ' · ' + t('cloud') + ' ' + Math.round(current.cloudCover) + '%'
        if (data.stale) footText = footText + ' · ' + t('offline')
        children.push(h('div', { key: 'foot', className: 'dshw-foot' }, footText))
        if (city && city.via === 'ip') {
          children.push(h('div', { key: 'iphint', className: 'dshw-foot dshw-iphint' }, t('ipHint')))
        }
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
    // 六款表盘主题：干净渐变底盘 + 细环 + 暖金主数字，靠配色与质感区分。
    var LS_DIAL = 'dsh-weather-badge.dial.v3'
    var DEFAULT_DIAL = 'ivory'
    var DIAL_CHANGED_EVENT = 'dsh-weather-badge:dial-changed'
    var DIAL_THEMES = [
      { id: 'ivory', label: '白金', numerals: true, ink: '#2b3038', major: '#a9812f', ring: '#c9d0d9',
        stops: [['0%', '#ffffff'], ['62%', '#f2f5f9'], ['100%', '#dfe5ec']],
        hour: '#15181e', minute: '#1f6fd0', second: '#e5342a' },
      { id: 'mist', label: '雾蓝', numerals: true, ink: '#24384d', major: '#a9812f', ring: '#b9cfe2',
        stops: [['0%', '#ffffff'], ['62%', '#eaf3fb'], ['100%', '#cfe0ef']],
        hour: '#101c2b', minute: '#1668c9', second: '#ea3a30' },
      { id: 'sand', label: '暖米', numerals: true, ink: '#3a322a', major: '#a9812f', ring: '#d9c8ad',
        stops: [['0%', '#fffdf8'], ['62%', '#f7efe1'], ['100%', '#eadcc6']],
        hour: '#241d16', minute: '#b06a1e', second: '#e0352b' },
      { id: 'lilac', label: '薄紫', numerals: true, ink: '#392d4d', major: '#a9812f', ring: '#cec1e6',
        stops: [['0%', '#fdfbff'], ['62%', '#f0eafb'], ['100%', '#ded2f2']],
        hour: '#1f1730', minute: '#6a3fbe', second: '#e0307a' },
      { id: 'graphite', label: '石墨', numerals: true, ink: '#f2f5f9', major: '#e3c479', ring: '#12151a',
        stops: [['0%', '#4b5260'], ['62%', '#333944'], ['100%', '#20242c']],
        hour: '#ffffff', minute: '#6fb6ff', second: '#ff6a55' },
      { id: 'jade', label: '青瓷', numerals: true, ink: '#223f3a', major: '#a9812f', ring: '#b9d6cc',
        stops: [['0%', '#ffffff'], ['62%', '#eaf6f2'], ['100%', '#cfe6de']],
        hour: '#0f2a26', minute: '#12876a', second: '#e5342a' },
    ]
    var DIAL_SHAPE_IDS = ['ivory', 'mist', 'sand', 'lilac', 'graphite', 'jade']

    /** 所有主题统一直径 47 的正圆；保留函数以兼容旧的轮廓调用。 */
    function dialRadius(id, angle) {
      return 47
    }

    /** 兼容旧代码：主题 id 必须在该表内，否则回落到第一个。 */
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

    /** 表盘刻度：60 格，每 5 格加粗，颜色取主题墨色。 */
    function dialTicks(theme, outer, innerMajor, innerMinor) {
      var out = []
      for (var i = 0; i < 60; i += 1) {
        var major = i % 5 === 0
        var a = (i * 6 - 90) * Math.PI / 180
        var r2 = major ? innerMajor : innerMinor
        out.push(h('line', {
          key: 'tick' + i,
          x1: 50 + Math.cos(a) * outer,
          y1: 50 + Math.sin(a) * outer,
          x2: 50 + Math.cos(a) * r2,
          y2: 50 + Math.sin(a) * r2,
          stroke: theme.ink,
          strokeWidth: major ? 1.1 : 0.55,
          strokeLinecap: 'round',
          opacity: major ? 0.5 : 0.26,
        }))
      }
      return out
    }

    /** 兼容旧调用：装饰统一并入表盘本体，这里返回空层。 */
    function dialDecor(id) {
      return []
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

    // 设置抽屉的展开状态：默认收起，展开状态本地记住。
    var LS_SETTINGS_OPEN = 'dsh-weather-badge.settings-open.v1'

    function loadSettingsOpen() {
      try {
        return window.localStorage.getItem(LS_SETTINGS_OPEN) === 'on'
      } catch (error) {
        return false
      }
    }

    /** 设置区是否展开，只影响本面板，不需要跨组件广播。 */
    function useSettingsOpen() {
      var state = react.useState(loadSettingsOpen)
      var setState = state[1]
      var setOpen = react.useCallback((next) => {
        var on = next === true
        try {
          window.localStorage.setItem(LS_SETTINGS_OPEN, on ? 'on' : 'off')
        } catch (error) { /* storage may be blocked */ }
        setState(on)
      }, [])
      return [state[0], setOpen]
    }

    // 日期条开关：账号下方那条「日期 · 星期」，可整条隐藏，隐藏后不占高度。
    var LS_INFO = 'dsh-weather-badge.info.v1'
    var INFO_CHANGED_EVENT = 'dsh-weather-badge:info-changed'

    function loadInfoVisible() {
      try {
        return window.localStorage.getItem(LS_INFO) !== 'off'
      } catch (error) {
        return true
      }
    }

    /** 日期条是否显示，账号徽章与面板共享同一份状态。 */
    function useInfoVisible() {
      var state = react.useState(loadInfoVisible)
      var visible = state[0]
      var setState = state[1]
      react.useEffect(() => {
        var onChange = () => setState(loadInfoVisible())
        window.addEventListener(INFO_CHANGED_EVENT, onChange)
        return () => window.removeEventListener(INFO_CHANGED_EVENT, onChange)
      }, [])
      var setVisible = react.useCallback((next) => {
        var on = next !== false
        try {
          window.localStorage.setItem(LS_INFO, on ? 'on' : 'off')
        } catch (error) { /* storage may be blocked */ }
        setState(on)
        try {
          window.dispatchEvent(new CustomEvent(INFO_CHANGED_EVENT, { detail: { visible: on } }))
        } catch (error) { /* the app shell always provides CustomEvent */ }
      }, [])
      return [visible, setVisible]
    }

    // 表盘轮廓开关：圆形 / 方形，时钟表盘与天气表盘各自一份，用户可切换并本地记住。
    var LS_WXSHAPE = 'dsh-weather-badge.wxshape.v1'
    var WXSHAPE_CHANGED_EVENT = 'dsh-weather-badge:wxshape-changed'
    var LS_CLOCKSHAPE = 'dsh-weather-badge.clockshape.v1'
    var CLOCKSHAPE_CHANGED_EVENT = 'dsh-weather-badge:clockshape-changed'
    var SHAPE_CHOICES = ['circle', 'square']

    function loadShape(key) {
      try {
        return window.localStorage.getItem(key) === 'square' ? 'square' : 'circle'
      } catch (error) {
        return 'circle'
      }
    }

    /** 通用轮廓状态：读本地存储、跨组件用 CustomEvent 同步、切换时写回。 */
    function useShape(key, eventName) {
      var state = react.useState(() => loadShape(key))
      var shape = state[0]
      var setState = state[1]
      react.useEffect(() => {
        var onChange = () => setState(loadShape(key))
        window.addEventListener(eventName, onChange)
        return () => window.removeEventListener(eventName, onChange)
      }, [key, eventName])
      var setShape = react.useCallback((next) => {
        if (SHAPE_CHOICES.indexOf(next) < 0) return
        try {
          window.localStorage.setItem(key, next)
        } catch (error) { /* storage may be blocked */ }
        setState(next)
        try {
          window.dispatchEvent(new CustomEvent(eventName, { detail: { shape: next } }))
        } catch (error) { /* the app shell always provides CustomEvent */ }
      }, [key, eventName])
      return [shape, setShape]
    }

    /** 天气表盘的轮廓，账号徽章与面板共享同一份状态。 */
    function useWxShape() {
      return useShape(LS_WXSHAPE, WXSHAPE_CHANGED_EVENT)
    }

    /** 时钟表盘的轮廓，账号徽章与面板共享同一份状态。 */
    function useClockShape() {
      return useShape(LS_CLOCKSHAPE, CLOCKSHAPE_CHANGED_EVENT)
    }

    var faceSeq = 0

    /** 极坐标取点：角度制，绕表盘中心 50,50，返回 [x, y]。 */
    function dialPoint(radius, angle) {
      var a = (angle - 90) * Math.PI / 180
      return [50 + Math.cos(a) * radius, 50 + Math.sin(a) * radius]
    }

    /** 锥形指针：根部在中心附近，尖端指向角度方向，两侧是直线，视觉上比圆头线更有分量。 */
    function handPolygon(angle, length, width, tail, color, opacity) {
      var tip = dialPoint(length, angle)
      var back = dialPoint(-tail, angle)
      var left = dialPoint(width / 2, angle + 90)
      var right = dialPoint(width / 2, angle - 90)
      return [tip[0], tip[1], left[0], left[1], back[0], back[1], right[0], right[1]]
        .map((value) => value.toFixed(2))
        .join(' ')
    }

    /** 表盘公共部分：底盘渐变、外圈、内衬细环、顶部高光、刻度与主数字。shape 为 'square' 时换圆角卡片轮廓。 */
    function dialBase(theme, gradientId, withNumerals, shape) {
      var square = shape === 'square'
      var out = []
      out.push(h('defs', { key: 'defs' },
        h('radialGradient', { id: gradientId, cx: '38%', cy: '26%', r: '88%' },
          theme.stops.map((pair, index) => h('stop', {
            key: 'stop' + index, offset: pair[0], 'stop-color': pair[1],
          })))))
      if (square) {
        // 方形：圆角卡片 + 外框细边，内衬改圆角矩形。
        out.push(h('rect', { key: 'shadow', x: 5.6, y: 6.6, width: 90, height: 90, rx: 24, fill: '#000', opacity: 0.1 }))
        out.push(h('rect', {
          key: 'face', x: 5, y: 5, width: 90, height: 90, rx: 24,
          fill: 'url(#' + gradientId + ')', className: 'dshw-dial-face',
        }))
        out.push(h('rect', {
          key: 'rim', x: 5.6, y: 5.6, width: 88.8, height: 88.8, rx: 23.4,
          fill: 'none', stroke: theme.ring, strokeWidth: 1.4, opacity: 0.75,
        }))
        out.push(h('rect', {
          key: 'inner', x: 13, y: 13, width: 74, height: 74, rx: 16,
          fill: 'none', stroke: theme.ink, strokeWidth: 0.5, opacity: 0.14,
        }))
        out.push(h('path', {
          key: 'gloss',
          d: 'M 18 34 A 32 32 0 0 1 82 34 A 44 44 0 0 0 18 34 Z',
          fill: '#ffffff',
          opacity: theme.id === 'graphite' ? 0.06 : 0.5,
        }))
      } else {
        // 轻微投影，让表盘从侧栏底色上"浮"起来一点点。
        out.push(h('circle', { key: 'shadow', cx: 50, cy: 51.6, r: 47.4, fill: '#000', opacity: 0.1 }))
        out.push(h('circle', { key: 'face', cx: 50, cy: 50, r: 47, fill: 'url(#' + gradientId + ')', className: 'dshw-dial-face' }))
        out.push(h('circle', { key: 'rim', cx: 50, cy: 50, r: 46.6, fill: 'none', stroke: theme.ring, strokeWidth: 1.4, opacity: 0.75 }))
        out.push(h('circle', { key: 'inner', cx: 50, cy: 50, r: 35.4, fill: 'none', stroke: theme.ink, strokeWidth: 0.5, opacity: 0.14 }))
        out.push(h('path', {
          key: 'gloss',
          d: 'M 20 32 A 40 40 0 0 1 80 32 A 46 46 0 0 0 20 32 Z',
          fill: '#ffffff',
          opacity: theme.id === 'graphite' ? 0.06 : 0.5,
        }))
      }
      var ticks = dialTicks(theme, 41.6, 37.6, 39.6)
      for (var i = 0; i < ticks.length; i += 1) out.push(ticks[i])
      if (withNumerals) {
        var labels = [[12, 0], [3, 90], [6, 180], [9, 270]]
        for (var n = 0; n < labels.length; n += 1) {
          var pos = dialPoint(32.4, labels[n][1])
          out.push(h('text', {
            key: 'numeral' + n,
            x: pos[0].toFixed(2),
            y: pos[1].toFixed(2),
            textAnchor: 'middle',
            dominantBaseline: 'central',
            fontSize: 10.5,
            fontWeight: 600,
            fill: theme.major,
            opacity: 0.92,
            className: 'dshw-numeral dshw-numeral-major',
          }, String(labels[n][0])))
        }
      }
      return out
    }

    /**
     * 圆形指针钟：时针、分针、秒针按当前时间转动，每秒重绘一次。
     * 全部用内联 SVG 画，不依赖任何图片资源，配色跟随所选表盘主题。
     */
    function AnalogClock(props) {
      var size = (props && props.size) || 46
      var external = props && props.now instanceof Date ? props.now : null
      var nowState = react.useState(() => currentTime())
      var setNow = nowState[1]
      var idRef = react.useRef(null)
      if (idRef.current === null) {
        faceSeq += 1
        idRef.current = 'dshwFace' + faceSeq
      }
      react.useEffect(() => {
        if (external) return undefined
        var timer = setInterval(() => setNow(currentTime()), 1000)
        return () => clearInterval(timer)
      }, [external ? 1 : 0])
      var now = external || nowState[0]
      var seconds = now.getSeconds()
      var minutes = now.getMinutes() + seconds / 60
      var hours = (now.getHours() % 12) + minutes / 60
      var dialId = (props && props.dial) || DEFAULT_DIAL
      var theme = dialTheme(dialId)
      var faceId = idRef.current
      var parts = dialBase(theme, faceId, true, props && props.shape)
      parts.push(h('polygon', {
        key: 'h-hour', className: 'dshw-hand-hour',
        points: handPolygon(hours * 30, 20, 6.4, 3.6, theme.hour, 0.95),
        fill: theme.hour, opacity: 0.95,
      }))
      parts.push(h('polygon', {
        key: 'h-minute', className: 'dshw-hand-minute',
        points: handPolygon(minutes * 6, 31, 4.8, 4.6, theme.minute, 0.95),
        fill: theme.minute, opacity: 0.95,
      }))
      parts.push(h('polygon', {
        key: 'h-second', className: 'dshw-hand-second',
        points: handPolygon(seconds * 6, 34, 2.1, 7.5, theme.second, 0.9),
        fill: theme.second, opacity: 0.9,
      }))
      parts.push(h('circle', { key: 'dot', cx: 50, cy: 50, r: 2.6, className: 'dshw-hand-dot', fill: theme.hour }))
      parts.push(h('circle', {
        key: 'dot-in', cx: 50, cy: 50, r: 1.05,
        fill: theme.id === 'graphite' ? '#20242c' : '#ffffff', opacity: 0.9,
      }))
      return h('svg', {
        width: size,
        height: size,
        viewBox: '-6 -6 112 112',
        role: 'img',
        'aria-label': pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
        className: props && props.className,
      }, parts)
    }

    /** 主题选择器里的缩略图：同款底盘与刻度，指针固定在 10:08。 */
    function DialSwatch(props) {
      var id = (props && props.id) || DEFAULT_DIAL
      var theme = dialTheme(id)
      var gradientId = 'dshwSwatch-' + id
      var parts = dialBase(theme, gradientId, false, props && props.shape)
      parts.push(h('line', {
        key: 'h', x1: 50, y1: 50, x2: dialPoint(21, 304)[0], y2: dialPoint(21, 304)[1],
        stroke: theme.hour, strokeWidth: 3.4, strokeLinecap: 'round',
      }))
      parts.push(h('line', {
        key: 'm', x1: 50, y1: 50, x2: dialPoint(30, 48)[0], y2: dialPoint(30, 48)[1],
        stroke: theme.minute, strokeWidth: 2.5, strokeLinecap: 'round',
      }))
      parts.push(h('circle', { key: 'd', cx: 50, cy: 50, r: 2.6, fill: theme.hour }))
      return h('svg', { viewBox: '-6 -6 112 112', 'aria-hidden': true }, parts)
    }

    // 网络时间：本机时钟可能不准，开启后从授时接口取 UTC 与本机时钟的偏差，
    // 之后所有显示的时间都在本机时钟上叠加这个偏差；取不到时自动回退本机时钟。
    var LS_NETTIME = 'dsh-weather-badge.nettime.v1'
    var NETTIME_CHANGED_EVENT = 'dsh-weather-badge:nettime-changed'
    var NETTIME_SYNCED_EVENT = 'dsh-weather-badge:nettime-synced'
    var NETTIME_REFRESH_MS = 10 * 60 * 1000

    function loadNetTime() {
      try {
        return window.localStorage.getItem(LS_NETTIME) !== 'off'
      } catch (error) {
        return true
      }
    }

    // offset 是「网络时间 - 本机时间」的毫秒差；state 为 ok 时才启用。
    var netTime = { offset: 0, syncedAt: 0, state: 'idle', pending: null }

    /** 把授时接口返回的 UTC 年月日时分秒换算成毫秒时间戳。 */
    function parseTimeApi(data) {
      if (!data || typeof data.year !== 'number' || typeof data.hour !== 'number') return null
      return Date.UTC(
        data.year,
        (typeof data.month === 'number' ? data.month : 1) - 1,
        typeof data.day === 'number' ? data.day : 1,
        data.hour,
        typeof data.minute === 'number' ? data.minute : 0,
        typeof data.seconds === 'number' ? data.seconds : 0,
        typeof data.milliSeconds === 'number' ? Math.floor(data.milliSeconds) : 0,
      )
    }

    /** 备用源：Cloudflare 的 trace 接口返回纯文本，其中 ts 是秒级时间戳。 */
    function parseCloudflareTrace(text) {
      var hit = /ts=([0-9]+(?:\.[0-9]+)?)/.exec(String(text === undefined || text === null ? '' : text))
      if (!hit) return null
      return Math.round(parseFloat(hit[1]) * 1000)
    }

    /** 依次尝试两个授时源，返回服务端时间戳与请求发出时刻（用于补偿往返耗时）。 */
    function fetchNetworkTime() {
      var startedAt = Date.now()
      return fetchJson('https://timeapi.io/api/Time/current/zone?timeZone=Etc/UTC', 6000)
        .then((data) => ({ serverMs: parseTimeApi(data), startedAt: startedAt }))
        .catch(() => fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(6000) })
          .then((response) => response.text())
          .then((text) => ({ serverMs: parseCloudflareTrace(text), startedAt: startedAt })))
    }

    /** 同步一次网络时间；并发调用共用同一个请求，往返耗时按一半补偿。 */
    function syncNetworkTime() {
      if (netTime.pending) return netTime.pending
      netTime.state = 'syncing'
      var pending = fetchNetworkTime().then((result) => {
        netTime.pending = null
        if (typeof result.serverMs !== 'number') {
          netTime.state = 'error'
          throw new Error('network time unavailable')
        }
        var arrivedAt = Date.now()
        var latency = Math.max(0, arrivedAt - result.startedAt) / 2
        netTime.offset = Math.round(result.serverMs + latency - arrivedAt)
        netTime.syncedAt = arrivedAt
        netTime.state = 'ok'
        try {
          window.dispatchEvent(new CustomEvent(NETTIME_SYNCED_EVENT))
        } catch (error) { /* 宿主一定提供 CustomEvent */ }
        return netTime.offset
      }).catch((error) => {
        netTime.pending = null
        netTime.state = 'error'
        try {
          window.dispatchEvent(new CustomEvent(NETTIME_SYNCED_EVENT))
        } catch (inner) { /* 同步失败不影响渲染 */ }
        throw error
      })
      // 后台同步没人等结果，先挂一个空的 catch，避免未处理的 reject。
      pending.catch(() => {})
      netTime.pending = pending
      return pending
    }

    /** 当前时间：开启网络时间且已同步成功时用网络时间，否则回退本机时钟。 */
    function currentTime() {
      var epoch = Date.now()
      if (loadNetTime() && netTime.state === 'ok') epoch += netTime.offset
      return new Date(epoch)
    }

    /** 时间源开关：本机时钟 / 网络时间，两个组件共享同一份状态。 */
    function useNetTime() {
      var state = react.useState(loadNetTime)
      var enabled = state[0]
      var setState = state[1]
      react.useEffect(() => {
        var onChange = () => setState(loadNetTime())
        window.addEventListener(NETTIME_CHANGED_EVENT, onChange)
        return () => window.removeEventListener(NETTIME_CHANGED_EVENT, onChange)
      }, [])
      // 开启时首次进入界面同步一次，之后每 10 分钟重新校准，抵消本机时钟漂移。
      react.useEffect(() => {
        if (!enabled) return undefined
        syncNetworkTime()
        var timer = setInterval(() => syncNetworkTime(), NETTIME_REFRESH_MS)
        return () => clearInterval(timer)
      }, [enabled])
      var setEnabled = react.useCallback((next) => {
        var on = next !== false
        try {
          window.localStorage.setItem(LS_NETTIME, on ? 'on' : 'off')
        } catch (error) { /* storage may be blocked */ }
        setState(on)
        if (on) syncNetworkTime()
        try {
          window.dispatchEvent(new CustomEvent(NETTIME_CHANGED_EVENT, { detail: { enabled: on } }))
        } catch (error) { /* 宿主一定提供 CustomEvent */ }
      }, [])
      return [enabled, setEnabled]
    }

    /** 每秒刷新一次的当前时间，跟随时间源设置。 */
    function useNow() {
      var state = react.useState(currentTime)
      var setNow = state[1]
      react.useEffect(() => {
        var timer = setInterval(() => setNow(currentTime()), 1000)
        // 网络时间同步成功后立刻改用新时间，不必等下一秒。
        var onSync = () => setNow(currentTime())
        window.addEventListener(NETTIME_SYNCED_EVENT, onSync)
        window.addEventListener(NETTIME_CHANGED_EVENT, onSync)
        return () => {
          clearInterval(timer)
          window.removeEventListener(NETTIME_SYNCED_EVENT, onSync)
          window.removeEventListener(NETTIME_CHANGED_EVENT, onSync)
        }
      }, [])
      return state[0]
    }

    // 天气表盘配色：按天气种类取三段浅→深的同色系渐变，做方形卡片底；
    // accent 用于外框细边与湿度条，ink 用于文字。
    var WEATHER_DIAL_COLORS = {
      clear: { hi: '#fffdf4', mid: '#ffeec2', lo: '#f3bb63', ink: '#4a3313', accent: '#c98423' },
      night: { hi: '#f7f9ff', mid: '#dde4ff', lo: '#9dabd9', ink: '#242d52', accent: '#4d5b96' },
      partly: { hi: '#fbfdff', mid: '#e4f1ff', lo: '#bcd7ef', ink: '#1d3348', accent: '#4a86bd' },
      cloud: { hi: '#fcfdff', mid: '#e9eff7', lo: '#c6d3e0', ink: '#2a3a49', accent: '#68798b' },
      fog: { hi: '#fdfefe', mid: '#eef2f6', lo: '#cfd7de', ink: '#2e3841', accent: '#727f8a' },
      rain: { hi: '#f9fcff', mid: '#dcecff', lo: '#a8cbe8', ink: '#173650', accent: '#2f6ea3' },
      snow: { hi: '#ffffff', mid: '#eaf6ff', lo: '#c3dcee', ink: '#1b3a50', accent: '#4d87b0' },
      thunder: { hi: '#faf8ff', mid: '#e5dbff', lo: '#b7a6dc', ink: '#2b1f47', accent: '#5c4790' },
    }

    /**
     * 天气表盘：圆盘与方形卡片两套轮廓，圆内/卡内都是上排天气图标、
     * 中间温度、底部湿度进度条与百分比，全部内联矢量。
     */
    function WeatherDial(props) {
      var size = (props && props.size) || 64
      var shape = props && props.shape === 'square' ? 'square' : 'circle'
      var code = props && props.code
      var isDay = props && props.isDay
      var kind = artKindOf(code, isDay)
      var palette = WEATHER_DIAL_COLORS[kind] || WEATHER_DIAL_COLORS.cloud
      var gradientId = 'dshwWx' + kind + shape
      var barId = 'dshwWxBar' + kind + shape
      var temperature = props && props.temperature
      var label = typeof temperature === 'number' ? Math.round(temperature) + '℃' : '—'
      // 湿度决定底部进度条长度；没有数据时只画空轨道。
      var humidity = props && typeof props.humidity === 'number'
        ? Math.max(0, Math.min(100, props.humidity))
        : null
      // 圆盘里的条要按弦长收窄，方形可以用满内边距。
      var barWidth = shape === 'square' ? 68 : 56
      var barX = shape === 'square' ? 16 : 22
      var barY = shape === 'square' ? 70 : 66
      var filled = humidity === null ? 0 : Math.round((barWidth * humidity) / 100)
      var parts = []
      parts.push(h('defs', { key: 'defs' },
        h('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0.35', y2: '1' },
          h('stop', { offset: '0%', 'stop-color': palette.hi }),
          h('stop', { offset: '55%', 'stop-color': palette.mid }),
          h('stop', { offset: '100%', 'stop-color': palette.lo })),
        h('linearGradient', { id: barId, x1: '0', y1: '0', x2: '1', y2: '0' },
          h('stop', { offset: '0%', 'stop-color': '#2f86c8' }),
          h('stop', { offset: '100%', 'stop-color': '#79c2ec' }))))
      if (shape === 'square') {
        // 方形：圆角卡片 + 外框细边。
        parts.push(h('rect', {
          key: 'face',
          x: 5, y: 5, width: 90, height: 90, rx: 24,
          fill: 'url(#' + gradientId + ')',
          stroke: palette.accent, strokeOpacity: 0.3, strokeWidth: 1.4,
        }))
      } else {
        // 圆形：与时钟表盘同一套投影、盘面、外圈细边、内衬细环。
        parts.push(h('circle', { key: 'shadow', cx: 50, cy: 51.6, r: 47.4, fill: '#000000', opacity: 0.1 }))
        parts.push(h('circle', { key: 'face', cx: 50, cy: 50, r: 47, fill: 'url(#' + gradientId + ')' }))
        parts.push(h('circle', {
          key: 'rim',
          cx: 50, cy: 50, r: 46.6, fill: 'none',
          stroke: palette.accent, strokeOpacity: 0.32, strokeWidth: 1.4,
        }))
        parts.push(h('circle', {
          key: 'inner',
          cx: 50, cy: 50, r: 38.5, fill: 'none',
          stroke: palette.ink, strokeOpacity: 0.12, strokeWidth: 0.6,
        }))
      }
      // 顶部高光斜切，两种轮廓共用。
      parts.push(h('path', {
        key: 'gloss',
        d: shape === 'square'
          ? 'M 18 30 A 34 34 0 0 1 82 30 A 44 44 0 0 0 18 30 Z'
          : 'M 16 30 A 34 34 0 0 1 84 30 A 46 46 0 0 0 16 30 Z',
        fill: '#ffffff', opacity: shape === 'square' ? 0.5 : 0.45,
      }))
      parts.push(h('rect', { key: 'bartrack', x: barX, y: barY, width: barWidth, height: 5.5, rx: 2.75, fill: palette.accent, opacity: 0.18 }))
      if (humidity !== null) {
        parts.push(h('rect', { key: 'barfill', x: barX, y: barY, width: filled, height: 5.5, rx: 2.75, fill: 'url(#' + barId + ')' }))
      }
      parts.push(h('text', {
        key: 'icon',
        x: 50, y: shape === 'square' ? 34 : 33,
        textAnchor: 'middle', dominantBaseline: 'central',
        fontSize: shape === 'square' ? 24 : 23,
        className: 'dshw-wxdial-icon',
      }, codeEmoji(code)))
      parts.push(h('text', {
        key: 'temp',
        x: 50, y: shape === 'square' ? 57 : 53,
        textAnchor: 'middle', dominantBaseline: 'central',
        fontSize: shape === 'square' ? 22 : 21,
        fontWeight: 600, fill: palette.ink, className: 'dshw-wxdial-temp',
      }, label))
      parts.push(h('text', {
        key: 'hum',
        x: 50, y: shape === 'square' ? 84 : 80,
        textAnchor: 'middle', dominantBaseline: 'central',
        fontSize: 10, fontWeight: 600, fill: '#2f6fae', className: 'dshw-wxdial-hum',
      }, humidity === null ? '--' : Math.round(humidity) + '%'))
      return h('svg', {
        // 与时钟表盘共用同一坐标系，圆形/方形的实际显示尺寸才能完全一致。
        viewBox: '-6 -6 112 112',
        width: size,
        height: size,
        className: 'dshw-wxdial',
        role: 'img',
        'aria-label': label,
      }, parts)
    }

    /** 账号右侧：时钟表盘 + 天气表盘。 */
    function WeatherClockChip(props) {
      var t = makeT(props && props.t)
      var dialState = useDialTheme()
      var now = useNow()
      var state = useWeatherSummary()
      var fontState = useFontChoice()
      var shapeState = useWxShape()
      var clockShapeState = useClockShape()
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
        h(AnalogClock, {
          size: 64,
          now: now,
          className: 'dshw-clock',
          dial: dialState[0],
          shape: clockShapeState[0],
        }),
        h(WeatherDial, {
          size: 64,
          shape: shapeState[0],
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
      var infoState = useInfoVisible()
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
      // 日期与星期按界面语言排版：中文「2026年11月13日 / 星期五」，英文「Nov 13, 2026 / Friday」。
      var zh = localeIsZh(t)
      var weekday = zh
        ? ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
      var clock = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds())
      var dateText = zh
        ? now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear()
      // 关掉日期条时整条不渲染：宿主是独立一行，不渲染就等于不占高度。
      if (!infoState[0]) return null
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
          // 日期条被关掉时宿主整行收起，避免账号行下方留下空档。
          infoHost.style.display = loadInfoVisible() ? '' : 'none'
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
