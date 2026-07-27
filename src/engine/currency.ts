/**
 * 货币转换支持
 * 使用 Frankfurter API (https://api.frankfurter.dev) - 免费、无需 API key
 */

// 货币符号映射
export const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '¥': 'CNY',
  '￥': 'CNY',
  '€': 'EUR',
  '£': 'GBP'
}

// 常用货币代码
export const SUPPORTED_CURRENCIES = [
  'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD', 'KRW',
  'AUD', 'CAD', 'CHF', 'SGD', 'THB', 'VND', 'MYR', 'INR'
]

interface ExchangeRates {
  base: string
  rates: Record<string, number>
  lastUpdate: number
}

const CACHE_KEY = 'suanzhi.currency.rates'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 小时

/**
 * 从 localStorage 加载缓存的汇率
 */
function loadCachedRates(): ExchangeRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    
    const data = JSON.parse(cached) as ExchangeRates
    const age = Date.now() - data.lastUpdate
    
    if (age < CACHE_DURATION) {
      return data
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * 保存汇率到 localStorage
 */
function saveCachedRates(rates: ExchangeRates): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates))
  } catch {
    // ignore
  }
}

/**
 * 获取汇率（优先使用缓存）
 */
export async function getExchangeRates(base: string = 'USD'): Promise<ExchangeRates | null> {
  // 检查缓存
  const cached = loadCachedRates()
  if (cached && cached.base === base) {
    return cached
  }
  
  // 从 API 获取
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/latest?base=${base}`)
    if (!response.ok) {
      console.error('Failed to fetch exchange rates:', response.statusText)
      return cached // 返回旧缓存
    }
    
    const data = await response.json()
    const rates: ExchangeRates = {
      base: data.base,
      rates: data.rates,
      lastUpdate: Date.now()
    }
    
    saveCachedRates(rates)
    return rates
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error)
    return cached // 返回旧缓存
  }
}

/**
 * 解析货币表达式
 * 支持格式：
 * - $100 in CNY
 * - €50 to ¥
 * - 100 USD to CNY
 * - 汇率 USD CNY
 */
export function parseCurrencyExpr(expr: string): {
  type: 'convert' | 'rate'
  amount?: number
  from?: string
  to?: string
} | null {
  // 标准化空格
  const normalized = expr.replace(/\s+/g, ' ').trim()
  
  // 汇率查询：汇率 USD CNY
  const rateMatch = normalized.match(/^汇率\s+([A-Z]{3})\s+([A-Z]{3})$/i)
  if (rateMatch) {
    return {
      type: 'rate',
      from: rateMatch[1].toUpperCase(),
      to: rateMatch[2].toUpperCase()
    }
  }
  
  // 转换：$100 in CNY 或 €50 to ¥
  const convertMatch = normalized.match(
    /^([\$€£¥￥])?\s*(\d+(?:\.\d+)?)\s+(?:in|to|→)\s+([A-Z]{3}|[\$€£¥￥])$/i
  )
  
  if (convertMatch) {
    const symbol = convertMatch[1]
    const amount = parseFloat(convertMatch[2])
    const toCurrency = convertMatch[3]
    
    // 解析 from 货币
    let fromCurrency: string
    if (symbol) {
      fromCurrency = CURRENCY_SYMBOLS[symbol] || 'USD'
    } else {
      return null // 没有符号也没有金额，无法解析
    }
    
    // 解析 to 货币
    let to: string
    if (toCurrency.length === 1) {
      to = CURRENCY_SYMBOLS[toCurrency] || 'CNY'
    } else {
      to = toCurrency.toUpperCase()
    }
    
    return {
      type: 'convert',
      amount,
      from: fromCurrency,
      to
    }
  }
  
  // 转换：100 USD to CNY
  const codeMatch = normalized.match(
    /^(\d+(?:\.\d+)?)\s+([A-Z]{3})\s+(?:in|to|→)\s+([A-Z]{3})$/i
  )
  
  if (codeMatch) {
    return {
      type: 'convert',
      amount: parseFloat(codeMatch[1]),
      from: codeMatch[2].toUpperCase(),
      to: codeMatch[3].toUpperCase()
    }
  }
  
  return null
}

/**
 * 执行货币转换
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number | null> {
  if (from === to) return amount
  
  const rates = await getExchangeRates(from)
  if (!rates || !rates.rates[to]) {
    return null
  }
  
  return amount * rates.rates[to]
}

/**
 * 获取汇率
 */
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  
  const rates = await getExchangeRates(from)
  if (!rates || !rates.rates[to]) {
    return null
  }
  
  return rates.rates[to]
}

/**
 * 默认汇率（fallback，当 API 请求失败或 localStorage 无缓存时使用）
 * 基于 2024 年初的近似汇率
 */
const DEFAULT_RATES: Record<string, Record<string, number>> = {
  USD: { CNY: 7.2, EUR: 0.92, GBP: 0.79, JPY: 148, HKD: 7.8, TWD: 31.5, KRW: 1320, AUD: 1.52, CAD: 1.35, CHF: 0.87, SGD: 1.34, THB: 35.5, VND: 24500, MYR: 4.7, INR: 83 },
  CNY: { USD: 0.14, EUR: 0.13, GBP: 0.11, JPY: 20.5, HKD: 1.08, TWD: 4.4, KRW: 183, AUD: 0.21, CAD: 0.19, CHF: 0.12, SGD: 0.19, THB: 4.9, VND: 3400, MYR: 0.65, INR: 11.5 },
  EUR: { USD: 1.09, CNY: 7.85, GBP: 0.86, JPY: 161, HKD: 8.5, TWD: 34, KRW: 1440, AUD: 1.65, CAD: 1.47, CHF: 0.95, SGD: 1.46, THB: 38.5, VND: 26700, MYR: 5.1, INR: 91 },
  GBP: { USD: 1.27, CNY: 9.15, EUR: 1.16, JPY: 188, HKD: 9.9, TWD: 39.5, KRW: 1675, AUD: 1.92, CAD: 1.71, CHF: 1.1, SGD: 1.7, THB: 45, VND: 31000, MYR: 5.95, INR: 106 },
  JPY: { USD: 0.0068, CNY: 0.049, EUR: 0.0062, GBP: 0.0053, HKD: 0.053, TWD: 0.21, KRW: 8.9, AUD: 0.01, CAD: 0.0091, CHF: 0.0059, SGD: 0.009, THB: 0.24, VND: 166, MYR: 0.032, INR: 0.56 },
}

/**
 * 同步读取缓存的汇率（供 evaluateDoc 同步使用）
 */
export function getRatesSync(base: string = 'USD'): ExchangeRates | null {
  const cached = loadCachedRates()
  if (cached && cached.base === base) {
    return cached
  }
  
  // Fallback to default rates
  if (DEFAULT_RATES[base]) {
    return {
      base,
      rates: DEFAULT_RATES[base],
      lastUpdate: 0, // Mark as default rates
    }
  }
  
  return null
}

/**
 * 同步货币转换（使用 localStorage 缓存）
 */
export function convertCurrencySync(
  amount: number,
  from: string,
  to: string,
): number | null {
  if (from === to) return amount
  const rates = getRatesSync(from)
  if (!rates || typeof rates.rates[to] !== 'number') return null
  return amount * rates.rates[to]
}

/**
 * 同步获取汇率
 */
export function getRateSync(from: string, to: string): number | null {
  if (from === to) return 1
  const rates = getRatesSync(from)
  if (!rates || typeof rates.rates[to] !== 'number') return null
  return rates.rates[to]
}

/**
 * 预取汇率（应用启动时调用，写入 localStorage）
 */
export async function prefetchRates(): Promise<void> {
  await getExchangeRates('USD')
}

/**
 * 格式化货币显示
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'CNY': '¥',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥'
  }
  
  const symbol = symbols[currency] || currency
  const decimals = currency === 'JPY' ? 0 : 2
  
  return `${symbol}${amount.toFixed(decimals)}`
}
