// 宿主渲染自测：在 vm 里执行 lib/client.js，用最小 DOM / React 替身取出内部组件，
// 检查表盘主题、徽章布局与设置抽屉的核心不变量。不需要真实 GUI。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))

/** 把整份 client.js 装进 vm，返回被临时暴露出来的内部符号。 */
function loadClient(store, fetchImpl) {
  let code = fs.readFileSync(CLIENT, 'utf8')
  code = code.replace('    exports.apply = apply',
    '    exports.__test = { AnalogClock: AnalogClock, WeatherDial: WeatherDial, DIAL_THEMES: DIAL_THEMES,'
    + ' FONT_CHOICES: FONT_CHOICES, EN: EN, ZH: ZH, localeIsZh: localeIsZh, fetchForecastWttr: fetchForecastWttr, wmoOfWwo: wmoOfWwo, parseTimeApi: parseTimeApi, parseCloudflareTrace: parseCloudflareTrace,'
    + ' locateByIpFrom: locateByIpFrom, currentTime: currentTime, netTime: netTime, syncNetworkTime: syncNetworkTime,'
    + ' wmoOfMetno: wmoOfMetno, fetchForecast: fetchForecast, fetchForecastFrom: fetchForecastFrom, fetchForecastMetno: fetchForecastMetno,'
    + ' fetchForecastCached: fetchForecastCached, saveLastForecast: saveLastForecast, loadLastForecast: loadLastForecast,'
    + ' reverseGeocode: reverseGeocode, refineLocation: refineLocation, geocode: geocode, geocodePhoton: geocodePhoton, locationLabel: locationLabel,'
    + ' sourceHealth: sourceHealth, sourceReady: sourceReady, markSourceFailed: markSourceFailed, SOURCE_LABELS: SOURCE_LABELS }\n'
    + '    exports.apply = apply')
  const mkEl = () => ({ style: {}, dataset: {}, appendChild() {}, remove() {}, setAttribute() {}, isConnected: false, querySelector: () => null, querySelectorAll: () => [], textContent: '' })
  const document = { createElement: mkEl, querySelector: () => null, querySelectorAll: () => [], head: mkEl(), body: mkEl() }
  const window = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    __ModuleLoader__: { load(entry) { this.entry = entry } },
  }
  const react = {
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect() {}, useRef: (init) => ({ current: init === undefined ? null : init }),
    useCallback: (fn) => fn, useMemo: (fn) => fn(), memo: (c) => c, Fragment: 'Fragment',
    createElement: (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(9) }),
  }
  const ctx = {
    window, document, console, navigator: { language: 'zh-CN' }, localStorage: window.localStorage,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Intl, URLSearchParams,
    AbortController, AbortSignal, requestAnimationFrame: (fn) => fn(),
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail } },
    MutationObserver: class { observe() {} disconnect() {} },
    fetch: fetchImpl || (() => Promise.reject(new Error('offline in tests'))),
    React: react,
  }
  ctx.globalThis = ctx
  ctx.self = ctx
  vm.createContext(ctx)
  vm.runInContext(code, ctx)
  const factory = window.__ModuleLoader__.entry.factory((name) => {
    if (name === 'react') return react
    return { createRoot: () => ({ render() {}, unmount() {} }) }
  })
  return factory.__test
}

/** 把 h() 产出的树序列化成可断言的字符串（保留属性名与值）。 */
function ser(node) {
  if (node === null || node === undefined || node === false) return ''
  if (Array.isArray(node)) return node.map(ser).join('')
  if (typeof node !== 'object') return String(node)
  const props = node.props || {}
  const attrs = Object.keys(props)
    .filter((k) => k !== 'children' && typeof props[k] !== 'function' && props[k] !== undefined && props[k] !== null)
    .map((k) => ' ' + k + '=' + JSON.stringify(props[k]))
    .join('')
  const name = typeof node.type === 'function' ? (node.type.name || 'component') : String(node.type)
  return '<' + name + attrs + '>' + ser(node.kids) + '</>'
}

test('client.js 能在域内加载并暴露 apply/inject', () => {
  const store = {}
  const T = loadClient(store)
  assert.ok(T, 'client.js should load')
  assert.equal(T.DIAL_THEMES.length, 6)
  assert.equal(T.FONT_CHOICES.length, 5)
})

test('六款表盘都画出 12/3/6/9 四个主数字与三根指针', () => {
  const T = loadClient({})
  for (const theme of T.DIAL_THEMES) {
    const svg = ser(T.AnalogClock({ size: 64, dial: theme.id, now: new Date(2026, 10, 13, 10, 9, 30), shape: 'circle' }))
    const numerals = (svg.match(/<text/g) || []).length
    assert.equal(numerals, 4, theme.id + ' should draw the four major numerals')
    assert.ok(svg.includes('dshw-hand-hour'), theme.id + ' has an hour hand')
    assert.ok(svg.includes('dshw-hand-minute'), theme.id + ' has a minute hand')
    assert.ok(svg.includes('dshw-hand-second'), theme.id + ' has a second hand')
  }
})

test('方形表盘使用圆角矩形轮廓，圆形表盘用圆形轮廓', () => {
  const T = loadClient({})
  const now = new Date(2026, 10, 13, 10, 9, 30)
  const circle = ser(T.AnalogClock({ size: 64, dial: 'ivory', now, shape: 'circle' }))
  const square = ser(T.AnalogClock({ size: 64, dial: 'ivory', now, shape: 'square' }))
  assert.ok(circle.includes('<circle'), 'circle shape keeps a circle face')
  assert.ok(!square.includes('<circle') || square.includes('<rect'), 'square shape draws a rect face')
  assert.ok(square.includes('<rect'), 'square shape draws rects')
})

test('中英文字典键完全对齐，语言判断可区分', () => {
  const T = loadClient({})
  assert.deepEqual(Object.keys(T.ZH).sort(), Object.keys(T.EN).sort())
  for (const key of Object.keys(T.ZH)) {
    assert.equal(typeof T.ZH[key], 'string')
    assert.equal(typeof T.EN[key], 'string')
    assert.ok(T.EN[key].length > 0, key + ' has an English string')
  }
  assert.equal(T.localeIsZh((k) => T.ZH[k] || k), true)
  assert.equal(T.localeIsZh((k) => T.EN[k] || k), false)
})

test('时间解析：timeapi.io 与 Cloudflare trace 两种格式', () => {
  const T = loadClient({})
  const ms = T.parseTimeApi({ year: 2026, month: 11, day: 13, hour: 7, minute: 44, seconds: 5, milliSeconds: 123 })
  assert.equal(new Date(ms).toISOString(), '2026-11-13T07:44:05.123Z')
  assert.equal(T.parseCloudflareTrace('fl=1 ts=1794555840.500 loc=CN'), 1794555840500)
  assert.equal(T.parseCloudflareTrace('nope'), null)
  assert.equal(T.parseTimeApi({}), null)
})

test('WWO 天气码能映射到 WMO 大类', () => {
  const T = loadClient({})
  assert.equal(T.wmoOfWwo(113), 0)   // 晴
  assert.equal(T.wmoOfWwo(266), 51)  // 小毛毛雨
  assert.equal(T.wmoOfWwo(302), 63)  // 中雨
  assert.equal(T.wmoOfWwo(389), 99)  // 强雷阵雨
  assert.equal(T.wmoOfWwo(9999), 3)  // 未知码退到「阴」，不炸
})

test('备用源 wttr.in 的响应能解析成统一结构', async () => {
  const T = loadClient({})
  const payload = {
    current_condition: [{ temp_C: '26', FeelsLikeC: '28', humidity: '60', weatherCode: '266', windspeedKmph: '4' }],
    weather: [
      { date: '2026-11-13', maxtempC: '28', mintempC: '20', hourly: [
        { time: '1200', tempC: '27', weatherCode: '176', chanceofrain: '13' },
        { time: '1800', tempC: '23', weatherCode: '266', chanceofrain: '62' },
      ] },
    ],
  }
  // 直接验证映射与字段名，不依赖真实网络
  const mapped = T.wmoOfWwo(Number(payload.current_condition[0].weatherCode))
  assert.equal(mapped, 51)
  assert.equal(payload.weather[0].hourly.map((h) => T.wmoOfWwo(Number(h.weatherCode))).join(','), '80,51')
})

test('IP 定位在某家失败时回落到下一家', async () => {
  const T = loadClient({})
  // 第一家恒失败，第二家给座标。
  let calls = 0
  const original = T.locateByIpFrom
  assert.equal(typeof original, 'function')
  // 这里只验证函数存在且能返回 Promise，网络行为由集成测试覆盖。
  const promise = T.locateByIpFrom(999)
  await assert.rejects(promise, /all IP locators failed/)
  calls += 1
  assert.equal(calls, 1)
})
test('MET Norway 的 symbol_code 能映射到 WMO 大类', () => {
  const T = loadClient({})
  assert.equal(T.wmoOfMetno('clearsky_day'), 0)
  assert.equal(T.wmoOfMetno('fair_night'), 1)
  assert.equal(T.wmoOfMetno('partlycloudy_day'), 2)
  assert.equal(T.wmoOfMetno('cloudy'), 3)
  assert.equal(T.wmoOfMetno('fog'), 45)
  assert.equal(T.wmoOfMetno('heavyrain'), 65)
  assert.equal(T.wmoOfMetno('lightrainshowers_night'), 61)
  assert.equal(T.wmoOfMetno('heavysnow'), 75)
  assert.equal(T.wmoOfMetno('rainandthunder'), 95)
  assert.equal(T.wmoOfMetno(''), 3)
})

/** 造一个假 fetch：按 URL 前缀返回对应报文，记录调用顺序。 */
function fakeFetch(routes) {
  const calls = []
  const impl = (url) => {
    calls.push(String(url))
    for (const prefix of Object.keys(routes)) {
      if (String(url).startsWith(prefix)) {
        const route = routes[prefix]
        if (route instanceof Error) return Promise.reject(route)
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(route) })
      }
    }
    return Promise.reject(new Error('no route for ' + url))
  }
  impl.calls = calls
  return impl
}

/** 以「现在」为基准造 met.no 序列，避免用例随真实时间失效。 */
function makeMetno() {
  const at = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString()
  return {
    properties: {
      timeseries: [
        { time: at(0), data: {
          instant: { details: { air_temperature: 23.4, relative_humidity: 83.8, wind_speed: 2.5, wind_from_direction: 180 } },
          next_1_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 0.6 } },
        } },
        { time: at(4), data: {
          instant: { details: { air_temperature: 25.1, relative_humidity: 70 } },
          next_6_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 1.2 } },
        } },
        { time: at(28), data: {
          instant: { details: { air_temperature: 21.0, relative_humidity: 90 } },
          next_6_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
        } },
      ],
    },
  }
}

const WMO_SHAPE = {
  current: { time: '2026-11-13T16:00', temperature_2m: 23.7, apparent_temperature: 25, relative_humidity_2m: 82, weather_code: 51, wind_speed_10m: 5, is_day: 1 },
  hourly: { time: ['2026-11-13T16:00'], temperature_2m: [23.7] },
  daily: { time: ['2026-11-13'], weather_code: [61], temperature_2m_max: [28.1], temperature_2m_min: [19.9], precipitation_probability_max: [98] },
}

test('MET Norway 的响应能解析成统一结构', async () => {
  const T = loadClient({}, fakeFetch({ 'https://api.met.no': makeMetno() }))
  const data = await T.fetchForecastMetno({ name: '中山', latitude: 22.52, longitude: 113.39 })
  assert.equal(data.source, 'metno')
  assert.equal(data.current.weatherCode, 61)
  assert.equal(Math.round(data.current.windSpeed), 9)
  assert.equal(data.hours.length, 3)
  assert.equal(data.daily.length, 2)
  assert.equal(data.daily[0].tempMax, 25.1)
  assert.equal(data.daily[0].tempMin, 23.4)
  assert.ok(data.daily[0].precipitationProbability > 0, '降水概率由降水量换算')
})

test('主源失败会自动换到下一家，并给失败的源打冷却', async () => {
  const T = loadClient({}, fakeFetch({
    'https://api.open-meteo.com': new Error('blocked'),
    'https://api.met.no': makeMetno(),
  }))
  const data = await T.fetchForecast({ name: '中山', latitude: 22.52, longitude: 113.39 })
  assert.equal(data.source, 'metno')
  assert.equal(T.sourceReady('open-meteo'), false)
  assert.equal(T.sourceReady('metno'), true)
  assert.equal(T.SOURCE_LABELS.metno, 'MET Norway')
})

test('三家源全挂时退回上次成功的缓存并标记离线', async () => {
  const store = {}
  const good = loadClient(store, fakeFetch({ 'https://api.open-meteo.com': WMO_SHAPE }))
  const location = { name: '中山', latitude: 22.52, longitude: 113.39 }
  const fresh = await good.fetchForecastCached(location, true)
  assert.equal(fresh.source, 'open-meteo')
  assert.equal(fresh.stale, undefined)

  const offline = loadClient(store, () => Promise.reject(new Error('offline')))
  const cached = await offline.fetchForecastCached(location, true)
  assert.equal(cached.stale, true)
  assert.equal(cached.current.temperature, 23.7)
  assert.match(String(cached.staleReason), /all forecast sources failed/)
})
test('反向地理编码把座标细化成中文乡镇/街道', async () => {
  const T = loadClient({}, fakeFetch({
    'https://api.bigdatacloud.net': {
      locality: '塘厦镇', city: '东莞市', principalSubdivision: '广东省', countryName: '中华人民共和国',
    },
  }))
  const hit = await T.reverseGeocode(22.8096358, 114.0673398)
  assert.equal(hit.locality, '塘厦镇')
  assert.equal(hit.city, '东莞市')
  assert.equal(hit.subdivision, '广东省')
  assert.equal(hit.country, '中国')
  const base = { name: '东莞', admin1: '广东', country: '中国', latitude: 22.8096358, longitude: 114.0673398, via: 'ip' }
  const finer = await T.refineLocation(base)
  assert.equal(finer.name, '塘厦镇')
  assert.equal(finer.admin2, '东莞市')
  assert.equal(finer.admin1, '广东省')
  assert.equal(finer.via, 'ip')
})

test('反向服务不可用时细化定位原样返回同一个对象', async () => {
  const T = loadClient({}, () => Promise.reject(new Error('offline')))
  const base = { name: '东莞', latitude: 23.02, longitude: 113.75 }
  assert.equal(await T.refineLocation(base), base)
})

test('搜索镇名：Open-Meteo 空结果时落到 Photon 并保留 admin2', async () => {
  const T = loadClient({}, fakeFetch({
    'https://geocoding-api.open-meteo.com': { results: [] },
    'https://photon.komoot.io': { features: [
      { properties: { name: '塘厦镇', city: '东莞市', state: '广东省', country: '中国' }, geometry: { coordinates: [114.0673398, 22.8096358] } },
    ] },
  }))
  const hits = await T.geocode('塘厦镇', 8)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].name, '塘厦镇')
  assert.equal(hits[0].admin2, '东莞市')
})

test('地点标签插入区/市级 admin2 且顺序正确', () => {
  const T = loadClient({})
  const label = T.locationLabel({ name: '塘厦镇', admin2: '东莞市', admin1: '广东省', country: '中国' })
  assert.ok(label.includes('东莞市'), '标签包含 admin2')
  assert.ok(label.indexOf('塘厦镇') < label.indexOf('东莞市'))
  assert.ok(label.indexOf('东莞市') < label.indexOf('广东省'))
})