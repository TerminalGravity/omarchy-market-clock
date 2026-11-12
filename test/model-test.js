// Run: node test/model-test.js
// Loads Model.js the way QML does (minus the .pragma line) and checks the
// session logic against fixed instants. All instants are given in UTC.
"use strict"
const fs = require("fs")
const path = require("path")
const vm = require("vm")
const assert = require("assert")

const src = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8").replace(/^\.pragma library\s*$/m, "")
const M = {}
vm.createContext(M)
vm.runInContext(src, M)

let n = 0
function check(name, utc, expect, opts) {
  const s = M.status(Date.parse(utc), opts)
  for (const [k, v] of Object.entries(expect)) {
    assert.deepStrictEqual(s[k], v, `${name}: ${k} = ${JSON.stringify(s[k])}, expected ${JSON.stringify(v)}`)
  }
  n++
}

// DST boundaries (2026: Mar 8 to Nov 1).
assert.strictEqual(M.etOffsetMinutes(Date.parse("2026-03-08T06:59:00Z")), -300)
assert.strictEqual(M.etOffsetMinutes(Date.parse("2026-03-08T07:00:00Z")), -240)
assert.strictEqual(M.etOffsetMinutes(Date.parse("2026-11-01T05:59:00Z")), -240)
assert.strictEqual(M.etOffsetMinutes(Date.parse("2026-11-01T06:00:00Z")), -300)

// Thu Nov 12 2026 (EST, UTC-5).
check("pre-market", "2026-11-12T13:00:00Z", { phase: "pre", etClock: "08:00", countdown: "1h30m", eventLabel: "open 09:30 ET" })
check("open", "2026-11-12T14:30:00Z", { phase: "open", etClock: "09:30", countdown: "6h30m", closingSoon: false })
check("closing soon", "2026-11-12T20:50:00Z", { phase: "open", countdown: "10m", closingSoon: true })
check("last seconds", "2026-11-12T20:59:30Z", { phase: "open", countdown: "<1m" })
check("after-hours", "2026-11-12T21:00:00Z", { phase: "after", countdown: "4h00m", eventLabel: "after-hours end 20:00 ET" })
check("night", "2026-11-13T02:00:00Z", { phase: "closed", eventLabel: "opens Fri 09:30 ET" })
check("pre-dawn same day", "2026-11-12T08:00:00Z", { phase: "closed", eventLabel: "opens 09:30 ET", countdown: "6h30m" })
check("no extended", "2026-11-12T13:00:00Z", { phase: "closed", eventLabel: "opens 09:30 ET" }, { extendedHours: false })
check("custom urgency", "2026-11-12T20:20:00Z", { closingSoon: true }, { urgentMinutes: 45 })

// Summer (EDT, UTC-4): Wed Jul 15 2026 09:30 ET = 13:30 UTC.
check("EDT open", "2026-07-15T13:30:00Z", { phase: "open", etClock: "09:30" })

// Weekend and holidays.
check("saturday", "2026-11-14T17:00:00Z", { phase: "closed", eventLabel: "opens Mon 09:30 ET", holiday: "" })
check("thanksgiving", "2026-11-26T17:00:00Z", { phase: "closed", holiday: "Thanksgiving Day", eventLabel: "opens Fri 09:30 ET" })
check("good friday", "2026-04-03T15:00:00Z", { phase: "closed", holiday: "Good Friday", eventLabel: "opens Mon 09:30 ET" })
check("july 3 observed", "2026-07-03T15:00:00Z", { phase: "closed", eventLabel: "opens Mon 09:30 ET" })
check("christmas weekend 2027", "2027-12-24T15:00:00Z", { phase: "closed", eventLabel: "opens Mon 09:30 ET" })
check("new year 2028 not observed", "2027-12-31T15:00:00Z", { phase: "open" })
check("calendar stale", "2029-03-14T15:00:00Z", { calendarStale: true })

// Early closes: Fri Nov 27 2026, 1:00 p.m. ET close, after-hours to 5:00 p.m.
check("early close open", "2026-11-27T17:30:00Z", { phase: "open", earlyClose: true, countdown: "30m", eventLabel: "close 13:00 ET" })
check("early close after", "2026-11-27T18:30:00Z", { phase: "after", eventLabel: "after-hours end 17:00 ET" })
check("early close evening", "2026-11-27T22:30:00Z", { phase: "closed" })

// Monthly options expiration: third Friday; Thursday when Friday is a holiday.
check("opex nov 2026", "2026-11-20T15:00:00Z", { expiration: true })
check("not opex", "2026-11-13T15:00:00Z", { expiration: false })
assert.strictEqual(M.isMonthlyExpiration(2027, 6, 17), true, "Jun 2027 opex moves to Thu 17 (Juneteenth observed Fri 18)")
assert.strictEqual(M.isMonthlyExpiration(2027, 6, 18), false)
assert.strictEqual(M.isMonthlyExpiration(2028, 4, 21), true, "Apr 2028 opex stays Fri 21 (Good Friday is the 14th)")

// Labels.
const s = M.status(Date.parse("2026-11-12T19:46:00Z"))
assert.strictEqual(M.barLabel(s, "countdown"), "OPEN 1h14m")
assert.strictEqual(M.barLabel(s, "clock"), "OPEN 14:46 ET")
assert.match(M.tooltip(s), /^US equities: Regular session\nNew York Thu 2026-11-12 14:46\nNext: close 16:00 ET \(in 1h14m\)$/)

// Every listed holiday must be a weekday (catches typos in the table).
for (const key of Object.keys(M.HOLIDAYS).concat(Object.keys(M.EARLY_CLOSES))) {
  const [y, m, d] = key.split("-").map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  assert.ok(wd >= 1 && wd <= 5, `${key} is a weekend`)
}

console.log(`ok - ${n} status checks plus calendar, DST, expiration and label checks`)
