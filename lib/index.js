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

/** Geocode one city name through Open-Meteo; throws a model-readable error when nothing matches. */
async function geocode(city, signal) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`
  const data = await fetchJson(url, GEOCODING_TIMEOUT_MS, signal)
  const hit = data && Array.isArray(data.results) ? data.results[0] : undefined
  if (!hit) {
    throw new Error(`没有找到城市「${city}」。请换一个名称重试（中文、英文或拼音均可，例如 "上海"、"Shanghai"）。`)
  }
  return {
    name: String(hit.name || city),
    admin1: typeof hit.admin1 === 'string' ? hit.admin1 : '',
    country: typeof hit.country === 'string' ? hit.country : '',
    latitude: num(hit.latitude),
    longitude: num(hit.longitude),
    via: 'search',
  }
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
      if (location && location.name) return await localizeLocation(location, signal)
      failures.push(provider.url)
    } catch (error) {
      failures.push(`${provider.url}（${error && error.message ? error.message : error}）`)
    }
  }
  throw new Error(`自动定位失败（${failures.join('；')}）。请在调用时通过 city 参数指定城市，例如 city="上海"。`)
}

/**
 * IP geolocation answers in English ("Dongguan", "Guangdong Sheng"); translate
 * the city name through the Chinese geocoder and keep the hit nearest the IP
 * coordinates, so the model-facing text matches the rest of the UI.
 */
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
      country: typeof best.country === 'string' ? best.country : location.country,
      latitude: num(best.latitude),
      longitude: num(best.longitude),
      via: location.via,
    }
  } catch (error) {
    return location
  }
}

async function fetchForecast(location, days, signal) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
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
  return {
    location: {
      name: location.name,
      admin1: location.admin1 || '',
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
      weatherCode: current.weather_code,
      weatherText: weatherText(current.weather_code),
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
  if (location.admin1 && location.admin1 !== location.name) parts.push(location.admin1)
  if (location.country) parts.push(location.country)
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
    value.location.locatedBy === 'ip' ? '（按 IP 粗略定位）' : ''
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
  lines.push('数据来源：Open-Meteo（免费，无需 API Key）。以上为天气预报，可能有误差。')
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
