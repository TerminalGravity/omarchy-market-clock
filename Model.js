.pragma library

// US equity session model for the Market Clock bar widget.
//
// Pure functions only (no QML types), so the same file runs under Node in
// test/model-test.js. Every time is computed from the UTC epoch, never from
// the machine's local zone, so the widget is correct wherever you are.
//
// Session times (NYSE Arca / Nasdaq extended hours, all America/New_York):
//   pre-market   04:00-09:30
//   regular      09:30-16:00   (13:00 on early-close days)
//   after-hours  16:00-20:00   (13:00-17:00 on early-close days)
// Source: https://www.nyse.com/markets/hours-calendars

// Full-day closures. Source: NYSE holiday table, 2026-2028.
var HOLIDAYS = {
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King, Jr. Day",
  "2026-02-16": "Washington's Birthday",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth",
  "2026-07-03": "Independence Day (observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day",
  "2027-01-18": "Martin Luther King, Jr. Day",
  "2027-02-15": "Washington's Birthday",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-06-18": "Juneteenth (observed)",
  "2027-07-05": "Independence Day (observed)",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving Day",
  "2027-12-24": "Christmas Day (observed)",
  "2028-01-17": "Martin Luther King, Jr. Day",
  "2028-02-21": "Washington's Birthday",
  "2028-04-14": "Good Friday",
  "2028-05-29": "Memorial Day",
  "2028-06-19": "Juneteenth",
  "2028-07-04": "Independence Day",
  "2028-09-04": "Labor Day",
  "2028-11-23": "Thanksgiving Day",
  "2028-12-25": "Christmas Day"
}

// 1:00 p.m. ET early closes. Source: footnotes of the same NYSE table.
var EARLY_CLOSES = {
  "2026-11-27": "Day after Thanksgiving",
  "2026-12-24": "Christmas Eve",
  "2027-11-26": "Day after Thanksgiving",
  "2028-07-03": "Day before Independence Day",
  "2028-11-24": "Day after Thanksgiving"
}

// The calendar above is complete through this year. After it, weekends are
// still handled but holidays are not, and the widget says so.
var CALENDAR_LAST_YEAR = 2028

var PRE_OPEN = 4 * 60
var OPEN = 9 * 60 + 30
var CLOSE = 16 * 60
var EARLY_CLOSE = 13 * 60
var AFTER_CLOSE = 20 * 60
var EARLY_AFTER_CLOSE = 17 * 60

var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function pad2(n) { return (n < 10 ? "0" : "") + n }

function dateKey(y, m, d) { return y + "-" + pad2(m) + "-" + pad2(d) }

// Day-of-month of the nth weekday (0 = Sunday) in a month (1-12).
function nthWeekday(y, m, weekday, n) {
  var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
}

// US Eastern offset from UTC in minutes (-240 in DST, -300 otherwise).
// DST runs from 2:00 local on the second Sunday of March (07:00 UTC) to
// 2:00 local on the first Sunday of November (06:00 UTC).
function etOffsetMinutes(utcMs) {
  var y = new Date(utcMs).getUTCFullYear()
  var start = Date.UTC(y, 2, nthWeekday(y, 3, 0, 2), 7, 0)
  var end = Date.UTC(y, 10, nthWeekday(y, 11, 0, 1), 6, 0)
  return utcMs >= start && utcMs < end ? -240 : -300
}

// Wall-clock fields of a UTC instant in New York.
function toEastern(utcMs) {
  var shifted = new Date(utcMs + etOffsetMinutes(utcMs) * 60000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds()
  }
}

// UTC instant of a New York wall time. Uses the offset at about local noon
// (17:00 UTC), which
// is safe because DST switches at 2:00 a.m., outside every session boundary.
function fromEastern(y, m, d, minutes) {
  var offset = etOffsetMinutes(Date.UTC(y, m - 1, d, 17, 0))
  return Date.UTC(y, m - 1, d, 0, 0) + (minutes - offset) * 60000
}

function addDays(y, m, d, n) {
  var t = new Date(Date.UTC(y, m - 1, d + n))
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), weekday: t.getUTCDay() }
}

function holidayName(y, m, d) {
  return HOLIDAYS[dateKey(y, m, d)] || ""
}

function isTradingDay(y, m, d) {
  var wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd !== 0 && wd !== 6 && !holidayName(y, m, d)
}

// Monthly equity options expiration: the third Friday, or the trading day
// before it when that Friday is an exchange holiday.
function isMonthlyExpiration(y, m, d) {
  var third = nthWeekday(y, m, 5, 3)
  var day = third
  while (day > 0 && !isTradingDay(y, m, day)) day--
  return d === day
}

function sessionBounds(y, m, d) {
  var early = !!EARLY_CLOSES[dateKey(y, m, d)]
  return {
    preOpen: PRE_OPEN,
    open: OPEN,
    close: early ? EARLY_CLOSE : CLOSE,
    afterClose: early ? EARLY_AFTER_CLOSE : AFTER_CLOSE,
    early: early,
    earlyReason: EARLY_CLOSES[dateKey(y, m, d)] || ""
  }
}

function formatClock(minutes) {
  return pad2(Math.floor(minutes / 60)) + ":" + pad2(minutes % 60)
}

// "2h14m", "42m", "<1m". Seconds are rounded up so "1m" never means 0s left.
function formatCountdown(seconds) {
  if (seconds < 60) return "<1m"
  var total = Math.ceil(seconds / 60)
  var h = Math.floor(total / 60)
  var mins = total % 60
  return h > 0 ? h + "h" + pad2(mins) + "m" : mins + "m"
}

// The next regular-session open strictly after `et` (a toEastern result).
function nextOpen(et) {
  for (var i = 0; i <= 14; i++) {
    var day = addDays(et.year, et.month, et.day, i)
    if (!isTradingDay(day.year, day.month, day.day)) continue
    if (i === 0 && et.minutes >= OPEN) continue
    return {
      year: day.year, month: day.month, day: day.day, weekday: day.weekday,
      utcMs: fromEastern(day.year, day.month, day.day, OPEN)
    }
  }
  return null
}

// Full status for a UTC instant.
//   options.extendedHours  include pre-market and after-hours (default true)
//   options.urgentMinutes  minutes before the close to flag (default 15)
function status(utcMs, options) {
  options = options || {}
  var extended = options.extendedHours !== false
  var urgentMinutes = options.urgentMinutes === undefined ? 15 : Number(options.urgentMinutes)

  var et = toEastern(utcMs)
  var nowMin = et.minutes + et.seconds / 60
  var trading = isTradingDay(et.year, et.month, et.day)
  var b = sessionBounds(et.year, et.month, et.day)
  var holiday = holidayName(et.year, et.month, et.day)

  var phase = "closed"
  var target = 0
  if (trading) {
    if (nowMin >= b.open && nowMin < b.close) { phase = "open"; target = b.close }
    else if (extended && nowMin >= b.preOpen && nowMin < b.open) { phase = "pre"; target = b.open }
    else if (extended && nowMin >= b.close && nowMin < b.afterClose) { phase = "after"; target = b.afterClose }
  }

  var result = {
    phase: phase,
    tag: { open: "OPEN", pre: "PRE", after: "AH", closed: "CLOSED" }[phase],
    etClock: formatClock(et.minutes),
    etDate: dateKey(et.year, et.month, et.day),
    weekday: DAY_NAMES[et.weekday],
    secondsToEvent: 0,
    eventLabel: "",
    countdown: "",
    closingSoon: false,
    earlyClose: trading && b.early,
    earlyReason: trading ? b.earlyReason : "",
    holiday: holiday,
    expiration: trading && isMonthlyExpiration(et.year, et.month, et.day),
    calendarStale: et.year > CALENDAR_LAST_YEAR,
    closeClock: formatClock(b.close)
  }

  if (phase !== "closed") {
    result.secondsToEvent = Math.max(0, Math.round((target - nowMin) * 60))
    result.eventLabel = { open: "close", pre: "open", after: "after-hours end" }[phase] + " " + formatClock(target) + " ET"
    result.closingSoon = phase === "open" && result.secondsToEvent <= urgentMinutes * 60
  } else {
    var next = nextOpen(et)
    if (next) {
      result.secondsToEvent = Math.max(0, Math.round((next.utcMs - utcMs) / 1000))
      var sameDay = next.year === et.year && next.month === et.month && next.day === et.day
      result.eventLabel = "opens " + (sameDay ? "" : DAY_NAMES[next.weekday] + " ") + "09:30 ET"
    }
  }
  result.countdown = result.eventLabel ? formatCountdown(result.secondsToEvent) : ""
  return result
}

// Bar text. mode "countdown" shows time to the next session event; "clock"
// shows New York time instead.
function barLabel(s, mode) {
  if (mode === "clock") return s.tag + " " + s.etClock + " ET"
  if (s.phase === "closed") return s.tag
  return s.tag + " " + s.countdown
}

function tooltip(s) {
  var lines = []
  var names = { open: "Regular session", pre: "Pre-market", after: "After-hours", closed: "Closed" }
  lines.push("US equities: " + names[s.phase])
  lines.push("New York " + s.weekday + " " + s.etDate + " " + s.etClock)
  if (s.eventLabel) lines.push("Next: " + s.eventLabel + " (in " + s.countdown + ")")
  if (s.holiday) lines.push("Holiday: " + s.holiday)
  if (s.earlyClose) lines.push("Early close " + s.closeClock + " ET: " + s.earlyReason)
  if (s.expiration) lines.push("Monthly options expiration today")
  if (s.calendarStale) lines.push("Holiday calendar ends " + CALENDAR_LAST_YEAR + "; update the plugin")
  return lines.join("\n")
}
