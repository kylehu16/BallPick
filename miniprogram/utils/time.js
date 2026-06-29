/**
 * 时间转换工具
 * 
 * 约定：服务器存储的时间均为 ISO 8601 字符串格式（UTC 时间）。
 * 如 '2026-06-11T12:00:00.000Z'
 * 前端展示时根据设备时区自动转换为本地时间。
 *
 * 用法：
 *   const { matchTimeNumToMs, matchTimeNumToLocal } = require('../../utils/time')
 */

/**
 * 将各种可能的时间格式统一转为 Date 对象（内部使用）
 * 支持的输入格式：
 *   - ISO 8601 字符串: '2026-06-11T12:00:00.000Z' / '2026-06-11T12:00:00+08:00'
 *   - Date 对象（CloudBase 可能返回）
 *   - 数字毫秒时间戳: 1768377600000
 *   - 14 位数字（yyyyMMddHHmmss）: 20260611140000
 *   - 8 位数字（yyyyMMdd）: 20260611
 * @param {*} value
 * @returns {Date|null}
 */
function parseToDate(value) {
  if (value == null) return null

  // 已经是 Date 对象
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    const str = String(value)
    // 14 位 yyyyMMddHHmmss 格式
    if (str.length === 14 && value > 20000101000000) {
      const y = parseInt(str.slice(0, 4))
      const m = parseInt(str.slice(4, 6)) - 1
      const d = parseInt(str.slice(6, 8))
      const h = parseInt(str.slice(8, 10))
      const min = parseInt(str.slice(10, 12))
      const s = parseInt(str.slice(12, 14))
      return new Date(Date.UTC(y, m, d, h, min, s))
    }
    // 8 位 yyyyMMdd 格式
    if (str.length === 8 && value > 20000101) {
      const y = parseInt(str.slice(0, 4))
      const m = parseInt(str.slice(4, 6)) - 1
      const d = parseInt(str.slice(6, 8))
      return new Date(Date.UTC(y, m, d, 0, 0, 0))
    }
    // Unix 秒时间戳（10位，约 2001-2286 年之间）
    if (str.length === 10 && value > 1000000000) {
      return new Date(value * 1000)
    }
    // Unix 毫秒时间戳（13位）
    if (str.length === 13) {
      return new Date(value)
    }
    // 兜底：尝试直接解析
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
    return null
  }

  // 字符串格式
  if (typeof value === 'string') {
    // 纯数字字符串，转成数字后按上面逻辑处理
    if (/^\d+$/.test(value)) {
      return parseToDate(Number(value))
    }
    // ISO 8601 或其他标准日期字符串
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
    return null
  }

  return null
}

/**
 * 将 UTC ISO 8601 字符串转为 UTC 毫秒时间戳（用于时间比较）
 * @param {*} value - 同 parseToDate 支持的所有格式
 * @returns {number} UTC 毫秒时间戳
 */
function matchTimeNumToMs(value) {
  const d = parseToDate(value)
  return d ? d.getTime() : 0
}

/**
 * 将比赛时间（任意支持格式）转为本地时区的展示字符串
 * 
 * 原理：将时间统一解析后，用 getHours() 等非 UTC 方法，
 * JavaScript 会自动转换为设备本地时区。
 *
 * @param {*} value - 同 parseToDate 支持的所有格式
 * @returns {{ date: string, time: string, fullDate: string }}
 *   例如在中国(UTC+8): { date: '2026年6月11日', time: '20:00', fullDate: '2026年6月11日' }
 */
function matchTimeNumToLocal(value) {
  const d = parseToDate(value)
  if (!d) return { date: '', time: '', fullDate: '' }

  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()

  return {
    date: `${year}年${month}月${day}日`,
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    fullDate: `${year}年${month}月${day}日`
  }
}

module.exports = {
  matchTimeNumToMs,
  matchTimeNumToLocal
}
