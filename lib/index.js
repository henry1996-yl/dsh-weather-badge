// dsh-weather-badge — host half.
//
// Registers one model-facing tool, `weather`: current conditions plus a
// multi-day forecast for a city, powered by the free Open-Meteo APIs (no API
// key). When the model omits `city`, the tool locates roughly by public IP
// (ipwho.is, then ipapi.co); a configured `defaultCity` wins over IP.
//
// Hand-written with zero package imports (node builtins only) — the same
// stance as @liustack/modlens: out-of-tree resolution of @deepseek-ai/*
// packages is not reliable for third-party plugins, and the tool registry
// accepts raw JSON-Schema definitions, so this file owns its own argument
// validation and rendering instead of importing defineTool/schemastery.

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const PHOTON_URL = 'https://photon.komoot.io/api/'
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

// Cooperative deadline declared to the tool registry; the timeout policy
// enforces it. Worst path is two IP providers plus one forecast call.
const TOOL_TIMEOUT_MS = 30_000
const GEOCODING_TIMEOUT_MS = 10_000
const IP_TIMEOUT_MS = 6_000
const FORECAST_TIMEOUT_MS = 12_000

// WMO weather interpretation codes (0..99) → short Chinese text.
const WEATHER_TEXT = {
  0: '晴',
  1: '基本晴',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '强冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '强冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小阵雨',
  81: '阵雨',
  82: '强阵雨',
  85: '小阵雪',
  86: '阵雪',
  95: '雷阵雨',
  96: '雷阵雨伴冰雹',
  99: '强雷阵雨伴冰雹',
}

const WEATHER_EMOJI = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '🌨️',
  80: '🌦️',
  81: '🌦️',
  82: '⛈️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
}

const COMPASS_ZH = ['北', '北北东', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南南西', '西南', '西西南', '西', '西西北', '西北', '北西北']

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function weatherText(code) {
  const text = WEATHER_TEXT[code]
  return text === undefined ? `代码 ${code}` : text
}

function weatherEmoji(code) {
  return WEATHER_EMOJI[code] || '🌡️'
}

function windDirectionText(degrees) {
  const deg = num(degrees)
  if (deg === null) return ''
  const index = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  return COMPASS_ZH[index]
}

function windLevelText(kmh) {
  const speed = num(kmh)
  if (speed === null) return ''
  const bounds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
  let level = bounds.length
  for (let i = 0; i < bounds.length; i += 1) {
    if (speed < bounds[i]) {
      level = i
      break
    }
  }
  return `${level} 级`
}

async function fetchJson(url, timeoutMs, signal) {
  const signals = [AbortSignal.timeout(timeoutMs)]
  if (signal) signals.push(signal)
  const response = await fetch(url, { signal: AbortSignal.any(signals) })
  if (!response.ok) throw new Error(`HTTP ${response.status}（${url}）`)
  return await response.json()
}

/** 把「上级地名 + 本级地名」连写拆成地理编码能认的候选，如「梅州兴宁市」→「梅州 兴宁市」。 */
function qualifiedVariants(city) {
  const out = []
  const push = (value) => {
    const v = String(value || '').trim()
    if (v.length >= 2 && v !== city && !out.includes(v)) out.push(v)
  }
  if (!/[\u3400-\u9fff]/.test(city) || city.length < 4) return out
  // 在 2~4 字处插空格，保留「上级 + 本级」上下文，Photon 命中率最高。
  for (let k = 2; k <= 4 && k <= city.length - 2; k += 1) push(`${city.slice(0, k)} ${city.slice(k)}`)
  // 再退到尾部地名与去掉行政后缀的短名。
  push(city.slice(-3))
  push(city.replace(/(省|市|区|县|镇|乡|街道)+$/, ''))
  push(city.slice(-2))
  return out.slice(0, 5)
}

/** 搜城市：两家源都空结果时，把复合地名拆开再试一轮。 */
async function geocode(city, signal) {
  const failures = []
  const queryOnce = async (query) => {
    try {
      const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=zh&format=json`
      const data = await fetchJson(url, GEOCODING_TIMEOUT_MS, signal)
      const hit = data && Array.isArray(data.results) ? data.results[0] : undefined
      if (hit) {
        return {
          name: String(hit.name || query),
          admin1: typeof hit.admin1 === 'string' ? hit.admin1 : '',
          admin2: typeof hit.admin2 === 'string' ? hit.admin2 : '',
          country: typeof hit.country === 'string' ? hit.country : '',
          latitude: num(hit.latitude),
          longitude: num(hit.longitude),
          via: 'search',
        }
      }
    } catch (error) {
      failures.push(`Open-Meteo（${error && error.message ? error.message : error}）`)
    }
    try {
      const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=1`
      const data = await fetchJson(url, GEOCODING_TIMEOUT_MS, signal)
      const feature = data && Array.isArray(data.features) ? data.features[0] : undefined
      const props = (feature && feature.properties) || {}
      const xy = (feature && feature.geometry && feature.geometry.coordinates) || []
      if (feature && xy.length >= 2) {
        return {
          name: String(props.name || props.city || props.county || query),
          admin1: typeof props.state === 'string' ? props.state : '',
          admin2: String(props.city || props.county || props.district || ''),
          country: typeof props.country === 'string' ? props.country : '',
          latitude: num(xy[1]),
          longitude: num(xy[0]),
          via: 'search',
        }
      }
    } catch (error) {
      failures.push(`Photon（${error && error.message ? error.message : error}）`)
    }
    return null
  }
  const first = await queryOnce(city)
  if (first) return first
  for (const variant of qualifiedVariants(city)) {
    const hit = await queryOnce(variant)
    if (hit) return hit
  }
  throw new Error(`没有找到城市「${city}」。请换一个名称重试（中文、英文或拼音均可，例如 "上海"、"Shanghai"）。${failures.length ? `（${failures.join('；')}）` : ''}`)
}

// Rough IP geolocation, best effort: each provider is skipped on any failure.
const IP_PROVIDERS = [
  {
    url: 'https://ipwho.is/',
    pick(data) {
      if (!data || data.success === false) return null
      const latitude = num(data.latitude)
      const longitude = num(data.longitude)
      if (latitude === null || longitude === null) return null
      return {
        name: typeof data.city === 'string' && data.city ? data.city : data.region || data.country || '',
        admin1: typeof data.region === 'string' ? data.region : '',
        country: typeof data.country === 'string' ? data.country : '',
        latitude,
        longitude,
        via: 'ip',
      }
    },
  },
  {
    url: 'https://ipapi.co/json/',
    pick(data) {
      if (!data || data.error) return null
      const latitude = num(data.latitude)
      const longitude = num(data.longitude)
      if (latitude === null || longitude === null) return null
      return {
        name: typeof data.city === 'string' && data.city ? data.city : data.region || data.country_name || '',
        admin1: typeof data.region === 'string' ? data.region : '',
        country: typeof data.country_name === 'string' ? data.country_name : '',
        latitude,
        longitude,
        via: 'ip',
      }
    },
  },
]

async function locateByIp(signal) {
  const failures = []
  for (const provider of IP_PROVIDERS) {
    try {
      const data = await fetchJson(provider.url, IP_TIMEOUT_MS, signal)
      const location = provider.pick(data)
      if (location && location.name) return await refineLocation(await localizeLocation(location, signal), signal)
      failures.push(provider.url)
    } catch (error) {
      failures.push(`${provider.url}（${error && error.message ? error.message : error}）`)
    }
  }
  throw new Error(`自动定位失败（${failures.join('；')}）。请在调用时通过 city 参数指定城市，例如 city="上海"。`)
}

/** 反向地理编码：把座标换成中文乡镇/街道、市、省、国家（BigDataCloud，CORS 开放）。 */
async function reverseGeocode(latitude, longitude, signal) {
  const url = REVERSE_URL + '?latitude=' + encodeURIComponent(latitude)
    + '&longitude=' + encodeURIComponent(longitude) + '&localityLanguage=zh'
  try {
    const data = await fetchJson(url, 8000, signal)
    if (!data || typeof data.locality !== 'string' || !data.locality) return null
    return {
      locality: data.locality,
      city: typeof data.city === 'string' ? data.city : '',
      subdivision: typeof data.principalSubdivision === 'string' ? data.principalSubdivision : '',
      country: data.countryName === '中华人民共和国' ? '中国'
        : (typeof data.countryName === 'string' ? data.countryName : ''),
    }
  } catch (error) {
    return null
  }
}

/** 把市级地名细化到乡镇/街道；反向服务拿不到结果时原样返回。 */
async function refineLocation(location, signal) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return location
  const hit = await reverseGeocode(location.latitude, location.longitude, signal)
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
}

/** 把英文 IP 地名换成中文地理编码命中项，尽量贴近原座标。 */
async function localizeLocation(location, signal) {
  if (!location || !location.name) return location
  if (/[\u3400-\u9fff]/.test(location.name)) return location
  try {
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(location.name)}&count=5&language=zh&format=json`
    const data = await fetchJson(url, GEOCODING_TIMEOUT_MS, signal)
    const hits = data && Array.isArray(data.results) ? data.results : []
    if (hits.length === 0) return location
    let best = null
    let bestDistance = Infinity
    for (const hit of hits) {
      const lat = num(hit.latitude)
      const lon = num(hit.longitude)
      if (lat === null || lon === null) continue
      const dx = lat - location.latitude
      const dy = lon - location.longitude
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = hit
      }
    }
    if (!best || bestDistance > 4) return location
    return {
      name: String(best.name || location.name),
      admin1: typeof best.admin1 === 'string' ? best.admin1 : location.admin1,
      admin2: typeof best.admin2 === 'string' ? best.admin2 : location.admin2,
      country: typeof best.country === 'string' ? best.country : location.country,
      latitude: num(best.latitude),
      longitude: num(best.longitude),
      via: location.via,
    }
  } catch (error) {
    return location
  }
}

// --- 三级预报源：Open-Meteo → MET Norway → wttr.in -------------------------
// 任何一家挂了或被限流就自动换下一家，全部失败才报错。MET Norway 用
// CC-BY 4.0，输出里必须署名。

const METNO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'
const WTTR_URL = 'https://wttr.in'
const METNO_UA = 'dsh-weather-badge/1.3.0 github.com/henry1996-yl/dsh-weather-badge'

/** met.no 的 symbol_code → WMO 大类。 */
function wmoOfMetno(symbol) {
  const code = String(symbol || '').toLowerCase()
  if (code.startsWith('clearsky')) return 0
  if (code.startsWith('fair')) return 1
  if (code.startsWith('partlycloudy')) return 2
  if (code.startsWith('cloudy')) return 3
  if (code.startsWith('fog')) return 45
  if (code.includes('thunder')) return 95
  if (code.includes('snow') || code.includes('sleet')) return 71
  if (code.includes('heavyrain')) return 65
  if (code.includes('lightrain')) return 61
  if (code.includes('rain')) return 63
  return 3
}

/** wttr.in 的 WWO 码 → WMO 大类。 */
const WWO_TO_WMO = {
  113: 0, 116: 1, 119: 2, 122: 3, 143: 45, 248: 45, 260: 45,
  176: 80, 263: 51, 266: 51, 293: 61, 296: 61, 299: 63, 302: 63, 305: 65, 308: 65,
  353: 80, 356: 81, 359: 82,
  179: 71, 182: 73, 185: 73, 227: 71, 230: 75, 320: 71, 323: 71, 326: 71, 329: 73, 332: 73, 335: 75, 338: 75,
  200: 95, 386: 95, 389: 95, 392: 95, 395: 95,
}

function wmoOfWwo(code) {
  const wmo = WWO_TO_WMO[Number(code)]
  return wmo === undefined ? 3 : wmo
}

/** 把 ms 时间戳转成本地时区的 ISO 串（不带 Z），供 daily 归属判断。 */
function localStamp(ms) {
  const date = new Date(ms)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 云量修正：WMO 码只按降水/能见度分档，晴/多云类用云量改到更贴近体感的档位。 */
function cloudAdjustedCode(code, cloudCover) {
  if (!Number.isFinite(code) || !Number.isFinite(cloudCover)) return code
  // 降水/雾/雪/雷等码保持原样，只在晴(0)/基本晴(1)/多云(2)/阴(3) 之间纠正。
  if (code !== 0 && code !== 1 && code !== 2 && code !== 3) return code
  if (cloudCover >= 85) return 3
  if (cloudCover >= 40) return 2
  if (cloudCover >= 15) return 1
  return code
}

/** 组装成与 Open-Meteo 分支一致的返回结构。 */
function buildForecast(location, current, daily, source) {
  return {
    location: {
      name: location.name,
      admin1: location.admin1 || '',
      admin2: location.admin2 || '',
      country: location.country || '',
      latitude: location.latitude,
      longitude: location.longitude,
      locatedBy: location.via,
    },
    current: Object.assign({}, current, {
      weatherText: weatherText(current.weatherCode),
      windDirection: windDirectionText(current.windDirectionDegrees),
      windLevel: windLevelText(current.windSpeed),
    }),
    daily: daily.map((day) => ({
      date: day.date,
      weatherCode: day.weatherCode,
      weatherText: weatherText(day.weatherCode),
      tempMax: num(day.tempMax),
      tempMin: num(day.tempMin),
      precipitationProbability: num(day.precipitationProbability),
    })),
    units: { temperature: '°C', wind: 'km/h', humidity: '%' },
    fetchedAt: new Date().toISOString(),
    source,
  }
}

async function fetchJsonWithHeaders(url, timeoutMs, signal, headers) {
  const signals = [AbortSignal.timeout(timeoutMs)]
  if (signal) signals.push(signal)
  const response = await fetch(url, { signal: AbortSignal.any(signals), headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}（${url}）`)
  return await response.json()
}

async function fetchForecastMetno(location, days, signal) {
  const url = `${METNO_URL}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`
  const data = await fetchJsonWithHeaders(url, FORECAST_TIMEOUT_MS, signal, {
    'User-Agent': METNO_UA,
    'Accept': 'application/json',
  })
  const series = data && data.properties && Array.isArray(data.properties.timeseries)
    ? data.properties.timeseries
    : []
  if (series.length === 0) throw new Error('MET Norway 返回了空的预报序列。')
  const now = Date.now()
  let currentEntry = series[0]
  for (const entry of series) {
    if (new Date(entry.time).getTime() <= now + 30 * 60 * 1000) currentEntry = entry
  }
  const details = (currentEntry.data && currentEntry.data.instant && currentEntry.data.instant.details) || {}
  const symbol = (currentEntry.data && currentEntry.data.next_1_hours && currentEntry.data.next_1_hours.summary
    && currentEntry.data.next_1_hours.summary.symbol_code) || ''
  const isDay = symbol.includes('night') ? 0 : 1
  const buckets = new Map()
  for (const entry of series) {
    const stamp = localStamp(new Date(entry.time).getTime())
    const date = stamp.slice(0, 10)
    const hour = Number(stamp.slice(11, 13))
    const cell = (entry.data && entry.data.instant && entry.data.instant.details) || {}
    const next6 = (entry.data && entry.data.next_6_hours) || (entry.data && entry.data.next_1_hours) || {}
    const temperature = num(cell.air_temperature)
    if (temperature === null) continue
    const bucket = buckets.get(date) || { date, temps: [], code: null, precip: 0 }
    bucket.temps.push(temperature)
    if (hour >= 11 && hour <= 13 && next6.summary) bucket.code = wmoOfMetno(next6.summary.symbol_code)
    const amount = num(next6.details && next6.details.precipitation_amount)
    if (amount !== null) bucket.precip = Math.max(bucket.precip, amount)
    buckets.set(date, bucket)
  }
  const daily = []
  for (const bucket of buckets.values()) {
    if (daily.length >= days) break
    daily.push({
      date: bucket.date,
      weatherCode: bucket.code === null ? 3 : bucket.code,
      tempMax: Math.max.apply(null, bucket.temps),
      tempMin: Math.min.apply(null, bucket.temps),
      precipitationProbability: Math.min(100, Math.round(bucket.precip * 20)),
    })
  }
  if (daily.length === 0) throw new Error('MET Norway 没有可用的逐日数据。')
  const current = {
    time: currentEntry.time,
    temperature: num(details.air_temperature),
    apparentTemperature: null,
    humidity: num(details.relative_humidity),
    cloudCover: num(details.cloud_area_fraction),
    weatherCode: cloudAdjustedCode(wmoOfMetno(symbol), num(details.cloud_area_fraction)),
    windSpeed: num(details.wind_speed) === null ? null : num(details.wind_speed) * 3.6,
    windDirectionDegrees: num(details.wind_from_direction),
    isDay,
  }
  return buildForecast(location, current, daily, 'metno')
}

async function fetchForecastWttr(location, days, signal) {
  const coord = `${location.latitude},${location.longitude}`
  const url = `${WTTR_URL}/${coord}?format=j1`
  const data = await fetchJson(url, FORECAST_TIMEOUT_MS, signal)
  const currentRaw = data && Array.isArray(data.current_condition) ? data.current_condition[0] : null
  const weather = data && Array.isArray(data.weather) ? data.weather : []
  if (!currentRaw || weather.length === 0) throw new Error('wttr.in 返回了无法识别的预报数据。')
  const nowHour = new Date().getHours()
  const current = {
    time: new Date().toISOString(),
    temperature: num(currentRaw.temp_C),
    apparentTemperature: num(currentRaw.FeelsLikeC),
    humidity: num(currentRaw.humidity),
    cloudCover: num(currentRaw.cloudcover),
    weatherCode: cloudAdjustedCode(wmoOfWwo(currentRaw.weatherCode), num(currentRaw.cloudcover)),
    windSpeed: num(currentRaw.windspeedKmph),
    windDirectionDegrees: num(currentRaw.winddirDegree),
    isDay: nowHour >= 6 && nowHour < 18 ? 1 : 0,
  }
  const daily = weather.slice(0, days).map((day) => {
    const stamp = String(day.date || '')
    const noon = Array.isArray(day.hourly)
      ? day.hourly.find((hour) => String(hour.time).padStart(4, '0') === '1200')
      : null
    const chance = Array.isArray(day.hourly)
      ? day.hourly.reduce((max, hour) => Math.max(max, num(hour.chanceofrain) || 0), 0)
      : 0
    return {
      date: stamp,
      weatherCode: noon ? wmoOfWwo(noon.weatherCode) : 3,
      tempMax: num(day.maxtempC),
      tempMin: num(day.mintempC),
      precipitationProbability: chance,
    }
  })
  return buildForecast(location, current, daily, 'wttr')
}

/** 源健康表：刚失败的源冷却一段时间，避免每次都卡在超时上。 */
const SOURCE_COOLDOWN_MS = 10 * 60 * 1000
const SOURCE_HEALTH = new Map()

function sourceReady(id) {
  const until = SOURCE_HEALTH.get(id)
  return !(typeof until === 'number' && until > Date.now())
}

function markSourceFailed(id) {
  SOURCE_HEALTH.set(id, Date.now() + SOURCE_COOLDOWN_MS)
}

const SOURCE_LABELS = { 'open-meteo': 'Open-Meteo', metno: 'MET Norway', wttr: 'wttr.in' }

/** 依次尝试三家预报源，跳过冷却中的源。 */
async function fetchForecast(location, days, signal) {
  const attempts = [
    { id: 'open-meteo', run: () => fetchForecastOpenMeteo(location, days, signal) },
    { id: 'metno', run: () => fetchForecastMetno(location, days, signal) },
    { id: 'wttr', run: () => fetchForecastWttr(location, days, signal) },
  ]
  const failures = []
  for (const attempt of attempts) {
    if (!sourceReady(attempt.id)) {
      failures.push(`${SOURCE_LABELS[attempt.id] || attempt.id}（冷却中）`)
      continue
    }
    try {
      return await attempt.run()
    } catch (error) {
      markSourceFailed(attempt.id)
      failures.push(`${SOURCE_LABELS[attempt.id] || attempt.id}（${error && error.message ? error.message : error}）`)
    }
  }
  throw new Error(`所有天气预报源都不可用：${failures.join('；')}`)
}

async function fetchForecastOpenMeteo(location, days, signal) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(days),
  })
  const data = await fetchJson(`${FORECAST_URL}?${params.toString()}`, FORECAST_TIMEOUT_MS, signal)
  if (!data || !data.current || !data.daily || !Array.isArray(data.daily.time)) {
    throw new Error('Open-Meteo 返回了无法识别的预报数据。')
  }
  const daily = data.daily.time.map((date, index) => ({
    date,
    weatherCode: data.daily.weather_code[index],
    weatherText: weatherText(data.daily.weather_code[index]),
    tempMax: num(data.daily.temperature_2m_max[index]),
    tempMin: num(data.daily.temperature_2m_min[index]),
    precipitationProbability: num(data.daily.precipitation_probability_max[index]),
  }))
  const current = data.current
  // WMO 码只按降水/能见度分档，用云量把晴/多云类纠正到更贴近体感的档位。
  const cloudCoverValue = num(current.cloud_cover)
  const weatherCodeFixed = cloudAdjustedCode(current.weather_code, cloudCoverValue)
  return {
    location: {
      name: location.name,
      admin1: location.admin1 || '',
      admin2: location.admin2 || '',
      country: location.country || '',
      latitude: location.latitude,
      longitude: location.longitude,
      locatedBy: location.via,
    },
    current: {
      time: typeof current.time === 'string' ? current.time : '',
      temperature: num(current.temperature_2m),
      apparentTemperature: num(current.apparent_temperature),
      humidity: num(current.relative_humidity_2m),
      cloudCover: cloudCoverValue,
      weatherCode: weatherCodeFixed,
      weatherText: weatherText(weatherCodeFixed),
      windSpeed: num(current.wind_speed_10m),
      windDirection: windDirectionText(current.wind_direction_10m),
      windLevel: windLevelText(current.wind_speed_10m),
    },
    daily,
    units: { temperature: '°C', wind: 'km/h', humidity: '%' },
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo',
  }
}

function formatLocationLabel(location) {
  const parts = [location.name]
  const seen = [location.name]
  if (location.admin2 && seen.indexOf(location.admin2) < 0) { parts.push(location.admin2); seen.push(location.admin2) }
  if (location.admin1 && seen.indexOf(location.admin1) < 0) { parts.push(location.admin1); seen.push(location.admin1) }
  if (location.country && seen.indexOf(location.country) < 0) parts.push(location.country)
  return parts.filter(Boolean).join('·')
}

function formatDayLabel(date, index) {
  if (index === 0) return '今天'
  if (index === 1) return '明天'
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00`).getDay()]
  return `${weekday} ${date.slice(5).replace('-', '/')}`
}

function formatClock(iso) {
  const match = /T(\d{2}:\d{2})/.exec(iso)
  return match ? match[1] : iso
}

/** Render the canonical output value as the model-facing text block. */
function renderWeather(value) {
  const lines = []
  const label = formatLocationLabel(value.location)
  const located =
    value.location.locatedBy === 'ip' ? '（按网络位置估计，可能不在实际所在地）' : ''
  const current = value.current
  const currentBits = [
    `${weatherEmoji(current.weatherCode)} ${current.weatherText}`,
    `${current.temperature}°C`,
  ]
  if (current.apparentTemperature !== null && current.apparentTemperature !== current.temperature) {
    currentBits.push(`体感 ${current.apparentTemperature}°C`)
  }
  if (current.humidity !== null) currentBits.push(`湿度 ${current.humidity}%`)
  if (current.windSpeed !== null) {
    const direction = current.windDirection ? `${current.windDirection}风` : '风'
    currentBits.push(`${direction} ${current.windSpeed}km/h${current.windLevel ? `（${current.windLevel}）` : ''}`)
  }
  if (Number.isFinite(current.cloudCover)) currentBits.push(`云量 ${Math.round(current.cloudCover)}%`)
  lines.push(`${label}${located} 当前天气（当地 ${formatClock(current.time)}）：${currentBits.join('，')}`)
  if (value.daily.length > 0) {
    lines.push('')
    lines.push(`未来 ${value.daily.length} 天预报：`)
    for (let i = 0; i < value.daily.length; i += 1) {
      const day = value.daily[i]
      const precip = day.precipitationProbability === null ? '' : `，降水概率 ${day.precipitationProbability}%`
      lines.push(`- ${formatDayLabel(day.date, i)}：${weatherEmoji(day.weatherCode)} ${day.weatherText}，${day.tempMin}~${day.tempMax}°C${precip}`)
    }
  }
  lines.push('')
  const sourceName = SOURCE_LABELS[value.source] || SOURCE_LABELS['open-meteo']
  const credit = value.source === 'metno' ? '（MET Norway，CC-BY 4.0）' : '（免费，无需 API Key）'
  lines.push(`数据来源：${sourceName}${credit}。以上为天气预报，可能有误差。`)
  return lines.join('\n')
}

const WEATHER_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    location: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        admin1: { type: 'string' },
        admin2: { type: 'string' },
        country: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        locatedBy: { type: 'string' },
      },
      required: ['name', 'latitude', 'longitude'],
    },
    current: {
      type: 'object',
      properties: {
        time: { type: 'string' },
        temperature: { type: 'number' },
        apparentTemperature: { type: 'number' },
        humidity: { type: 'number' },
        cloudCover: { type: 'number' },
        weatherCode: { type: 'integer' },
        weatherText: { type: 'string' },
        windSpeed: { type: 'number' },
        windDirection: { type: 'string' },
        windLevel: { type: 'string' },
      },
      required: ['temperature', 'weatherText'],
    },
    daily: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          weatherCode: { type: 'integer' },
          weatherText: { type: 'string' },
          tempMax: { type: 'number' },
          tempMin: { type: 'number' },
          precipitationProbability: { type: 'number' },
        },
        required: ['date', 'weatherText', 'tempMax', 'tempMin'],
      },
    },
    fetchedAt: { type: 'string' },
    source: { type: 'string' },
  },
  required: ['location', 'current', 'daily'],
}

/** Plugin identity for cordis loader diagnostics. */
export const name = 'dsh-weather-badge'

/** Services required by the weather tool. */
export const inject = ['tools']

/**
 * Register the `weather` tool.
 * @param ctx - host context whose tools registry receives the registration.
 * @param config - optional profile override: `{ toolName?, defaultCity?, days? }`.
 */
export function apply(ctx, config = {}) {
  const toolName = typeof config.toolName === 'string' && config.toolName.trim() ? config.toolName.trim() : 'weather'
  const defaultCity = typeof config.defaultCity === 'string' ? config.defaultCity.trim() : ''
  let defaultDays = Number(config.days)
  if (!Number.isInteger(defaultDays)) defaultDays = 3
  defaultDays = Math.min(7, Math.max(1, defaultDays))

  const weatherTool = {
    name: toolName,
    description:
      '查询一个城市的实时天气与未来几天预报。省略 city 时按 IP 粗略定位当前城市；city 支持中文、英文或拼音（如 "上海"、"Shanghai"）。返回当前温度、体感、湿度、风况与逐日预报（最高/最低温、降水概率）。回答天气相关问题时优先使用本工具。',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称（中文、英文或拼音）。省略时按 IP 粗略定位。',
        },
        days: {
          type: 'integer',
          description: '预报天数，1-7，默认 3。',
        },
      },
    },
    output: {
      schema: WEATHER_OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderWeather(value) }],
    },
    timeoutMs: TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: args && typeof args.city === 'string' && args.city.trim() ? `${toolName}: ${args.city.trim()}` : `${toolName}: 自动定位`,
      kind: 'search',
      rawInput: args && typeof args.city === 'string' ? args.city : 'auto',
    }),
    async execute(args, exec) {
      if (args !== undefined && args !== null && typeof args !== 'object') {
        throw new Error(`${toolName} 的参数必须是一个对象。`)
      }
      if (args && args.city !== undefined && typeof args.city !== 'string') {
        throw new Error(`${toolName}: city 必须是字符串。`)
      }
      if (args && args.days !== undefined && !Number.isInteger(args.days)) {
        throw new Error(`${toolName}: days 必须是整数（1-7）。`)
      }
      const signal = exec && exec.signal ? exec.signal : undefined
      const city = args && typeof args.city === 'string' ? args.city.trim() : ''
      let days = args && Number.isInteger(args.days) ? args.days : defaultDays
      days = Math.min(7, Math.max(1, days))
      let location
      if (city) {
        location = await geocode(city, signal)
      } else if (defaultCity) {
        location = await geocode(defaultCity, signal)
      } else {
        location = await locateByIp(signal)
      }
      return await fetchForecast(location, days, signal)
    },
  }

  try {
    ctx.tools.register(weatherTool)
  } catch (error) {
    console.error(`[dsh-weather-badge] ${toolName} 注册失败: ${error}`)
  }
}
