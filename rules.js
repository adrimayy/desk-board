/* Desk Board: the calendar rules, in one place.
   The phone board, the desktop board, the widget and the calendar script (as Rules.gs)
   all use this file, so a deadline is found, dated and shown the same way everywhere.
   Plain functions and `var` on purpose: it's loaded as a classic script next to others. */

var DAY = 86400000;
function pad(n) { return String(n).padStart(2, "0"); }
function dayKey(d) { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function startOfDay(d) { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n, hour) { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, hour || 0).getTime(); }
function fmtTime(ms) { var d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }   // 24-hour
var clockShort = fmtTime;
function fmtDur(ms) {
  var m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + " min";
  var h = Math.floor(m / 60), r = m % 60;
  return r ? h + "h " + r + "m" : h + "h";
}
function localDate(s) { var p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).getTime(); }
function plainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|ul|ol)>/gi, "\n").replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

// PACER learning modes from a "Mode: C + E" line, and how to digest each.
var PACER = {
  P: { name: "Procedural", short: "Practice", verb: "practice it now" },
  A: { name: "Analogous", short: "Critique", verb: "critique your analogy" },
  C: { name: "Conceptual", short: "Map", verb: "add it to your map" },
  E: { name: "Evidence", short: "Store", verb: "store the evidence" },
  R: { name: "Reference", short: "Cards", verb: "make flashcards" }
};
function modesFrom(text) {
  var m = /^\s*Mode\s*:\s*([^\n]+)/im.exec(text);
  if (!m) return [];
  return "PACER".split("").filter(function (k) { return new RegExp("(^|[^A-Za-z])" + k + "([^A-Za-z]|$)").test(m[1].toUpperCase()); });
}

/* ---------- What counts as a deadline ---------- */
// Errs toward showing too much: a false deadline costs a glance, a missed one costs a grade.
var DUE_WORD_RX = /\b(due|deadline|submit|submission|turn in|hand in)\b/i;
var EXAM_RX = /\b(quiz|exam|test|midterm|final|finals|drill)\b/i;
var WORK_RX = /\b(hw|homework|pset|problem set|assignment|essay|paper|lab report|report|project|presentation)\b/i;
var PREP_RX = /\b(prep|review|study|studying|office hours|session|workshop|out|released?|practice)\b/i;

function isDeadline(e) {
  if (e.src === "canvas") return true;               // everything in the Canvas feed
  if (e.src === "study" || e.src === "sleep") return false;   // your own work time, even "Quiz 3 review"
  var t = e.title || "";
  if (DUE_WORD_RX.test(t)) return true;               // "Study guide due", "Essay 3 due 18:00", any length
  if (EXAM_RX.test(t) && !PREP_RX.test(t)) return true;   // "Midterm", "Lit Hum Quiz 4", not "Midterm review"
  if (e.allDay && WORK_RX.test(t) && !PREP_RX.test(t)) return true;   // all-day "Pset 6", "Essay 3"
  return false;
}
function isExam(d) { return EXAM_RX.test((d.raw || d.title || "")) && !/\bfinal (draft|pass|version)\b/i.test(d.raw || d.title || ""); }

function splitCanvas(title) {
  var m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(title);
  if (!m) return { title: title, course: "" };
  var course = m[2].split(" - ").slice(1).join(" - ") || m[2];
  course = course.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); })
    .replace(/\b(Of|And|To|In|For|The)\b/g, function (w, x, i) { return i ? w.toLowerCase() : w; });
  return { title: m[1], course: course };
}
var STOP = { due: 1, the: 1, and: 1, of: 1, a: 1, to: 1, "for": 1, "in": 1, on: 1, by: 1, at: 1, pm: 1, am: 1, "this": 1, week: 1, part: 1 };
function tokens(s) {
  var set = {};
  String(s).toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) { if (w && !STOP[w]) set[w] = 1; });
  return set;
}
function shared(a, b) { var n = 0; for (var k in a) if (b[k]) n++; return n; }
function sharesNumber(a, b) { for (var k in a) if (/^\d+$/.test(k) && b[k]) return true; return false; }
function dayGap(a, b) {
  var p = a.split("-").map(Number), q = b.split("-").map(Number);
  return Math.round((new Date(p[0], p[1] - 1, p[2]) - new Date(q[0], q[1] - 1, q[2])) / DAY);
}
// A time written in an all-day event's title: "due 6 PM", "due at 11:59pm", "due by 9am", "due 18:00".
function timeInTitle(title, dayStart) {
  var m = /\bdue\b(?:\s+(?:at|by))?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d:])/i.exec(title);
  if (!m || (!m[2] && !m[3])) return null;            // "Essay 3 due 2" is not a time
  var h = Number(m[1]);
  if (m[3]) h = h % 12 + (/p/i.test(m[3]) ? 12 : 0);
  if (h > 23 || Number(m[2] || 0) > 59) return null;
  var d = new Date(dayStart);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, Number(m[2] || 0)).getTime();
}

/* ---------- Same assignment or not ---------- */
var KINDS = { essay: "essay", paper: "essay", draft: "essay", report: "report", lab: "lab", pset: "pset", psets: "pset",
  problem: "pset", hw: "pset", homework: "pset", exercise: "exercise", reading: "reading", rdg: "reading", wr: "reading",
  quiz: "exam", exam: "exam", test: "exam", midterm: "exam", "final": "exam", review: "review", slides: "slides",
  project: "project", presentation: "presentation" };
var ACCEPTS = { exam: { exam: 1, review: 1, reading: 1 } };
function kindOf(title) { var k = null; String(title).toLowerCase().split(/[^a-z]+/).some(function (w) { k = KINDS[w] || null; return k; }); return k; }
function idsOf(title) { return (String(title).toLowerCase().match(/\b\d+[a-z]?\b|\bwr\d+\b/g) || []).map(function (x) { return x.replace(/^wr/, ""); }); }
function sameIds(a, b) {
  var x = idsOf(a), y = idsOf(b);
  return !(x.length && y.length && !x.some(function (v) { return y.indexOf(v) >= 0; }));
}
function sameKind(a, b) { var ka = kindOf(a), kb = kindOf(b); return !ka || !kb || ka === kb; }
function normTitle(t) { return String(t).toLowerCase().replace(/\bdue\b.*$/, "").replace(/[^a-z0-9]+/g, " ").trim(); }

// Two calendar entries are one deadline only when it's clearly the same thing:
// the same title on the same day (the same event on two synced calendars), or a
// Canvas item and your own entry with the same assignment number and kind of work.
// Two different Canvas items are never merged, and neither are two of your own
// entries with different titles, so nothing disappears into something else.
function sameDeadline(a, b) {
  if (a.day === b.day && normTitle(a.title) === normTitle(b.title)) return true;
  var canvasPair = (a.src === "canvas") !== (b.src === "canvas");
  if (!canvasPair) return false;
  var x = a.raw || a.title, y = b.raw || b.title;
  if (!sameIds(x, y) || !sameKind(x, y)) return false;
  var n = shared(a.tok, b.tok);
  if (a.day === b.day) return n >= 2;
  return Math.abs(dayGap(a.day, b.day)) <= 10 && n >= 2 && sharesNumber(a.tok, b.tok);
}

// Every deadline from today on, one row each, soonest first.
// When two entries are the same deadline, the earlier date and time win.
function buildDeadlines(events, now) {
  var today = dayKey(now);
  var items = events.filter(isDeadline).map(function (e) {
    var parts = e.src === "canvas" ? splitCanvas(e.title) : { title: e.title, course: "" };
    // Timed: the start (an exam starts then; a "due" event's start is the earliest it could mean).
    var dueAt = e.allDay ? timeInTitle(e.title, e.start) : e.start;
    var day = e.allDay ? dayKey(e.start) : dayKey(dueAt);
    return { title: parts.title, raw: e.title, course: parts.course, dueAt: dueAt, day: day, src: e.src, tok: tokens(parts.title + " " + parts.course),
      refs: [{ cal: e.src, id: e.id, start: e.start, allDay: !!e.allDay, rec: !!e.rec }] };   // the calendar entries behind it
  }).filter(function (d) { return d.day >= today; });

  var merged = [];
  items.sort(function (a, b) { return (b.src === "canvas") - (a.src === "canvas"); });
  items.forEach(function (d) {
    var twin = merged.filter(function (m) { return sameDeadline(m, d); })[0];
    if (!twin) { merged.push(d); return; }
    // Earlier wins: you never see a deadline later than any calendar says it is.
    var tEnd = twin.dueAt || localDate(twin.day) + DAY - 60000, dEnd = d.dueAt || localDate(d.day) + DAY - 60000;
    if (dEnd < tEnd) { twin.day = d.day; twin.dueAt = d.dueAt; }
    else if (twin.day === d.day && !twin.dueAt && d.dueAt) twin.dueAt = d.dueAt;
    if (d.src !== "canvas" && d.title.length < twin.title.length) { twin.title = d.title; twin.raw = d.raw; }
    if (!twin.course && d.course) twin.course = d.course;
    twin.also = (twin.also || []).concat([d.raw]);
    twin.refs = twin.refs.concat(d.refs);
    for (var k in d.tok) twin.tok[k] = 1;
  });
  merged.sort(function (a, b) {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return (a.dueAt || DAY * 1e5) - (b.dueAt || DAY * 1e5);   // timed before untimed on the same day
  });
  return merged;
}
// Same key everywhere, so "done" on one board is done on all of them.
function dueKey(d) { return (d.day + "|" + String(d.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).slice(0, 51); }
// When a deadline without a time is treated as due: the end of its day.
function dueEndOf(d) { return d.dueAt || localDate(d.day) + DAY - 60000; }

/* ---------- Work planned for a deadline ---------- */
var GENERIC = { lab: 1, reading: 1, essay: 1, report: 1, quiz: 1, exam: 1, test: 1, review: 1, work: 1, practice: 1,
  finish: 1, start: 1, prep: 1, submit: 1, weekly: 1, "final": 1, draft: 1, exercise: 1, intro: 1, introductory: 1,
  experimental: 1, university: 1, writing: 1, lesson: 1, week: 1, "short": 1, part: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, sun: 1 };
function distinctTokens(tok) {
  var o = {};
  for (var k in tok) if (!GENERIC[k] && !/^\d+$/.test(k) && k.length > 1) o[k] = 1;
  return o;
}
// Does a work block belong to this deadline? Same course words, no conflicting assignment
// number, and a compatible kind of work (reading and review count toward a quiz).
function sameWork(d, key, blockTitle) {
  if (shared(key, tokens(blockTitle)) < 1) return false;
  if (!sameIds(d.title, blockTitle)) return false;
  var kd = kindOf(d.raw || d.title), kb = kindOf(blockTitle);
  if (kd && kb && kd !== kb && !(ACCEPTS[kd] && ACCEPTS[kd][kb])) return false;
  return true;
}
function plannedFor(events, d, now) {
  var t = now.getTime(), p = d.day.split("-").map(Number);
  var dueEnd = d.dueAt || new Date(p[0], p[1] - 1, p[2], 12).getTime();
  if (dueEnd <= t) return { show: false, min: 0 };
  var key = distinctTokens(d.tok), min = 0, seen = {};
  events.forEach(function (ev) {
    if (ev.src !== "study" || ev.allDay) return;   // only work blocks count, not the class itself
    if (ev.end - ev.start < 30 * 60000 || ev.end <= t || ev.start >= dueEnd) return;
    var sk = ev.title.toLowerCase() + "|" + ev.start;
    if (seen[sk]) return; seen[sk] = 1;
    if (sameWork(d, key, ev.title)) min += (Math.min(ev.end, dueEnd) - Math.max(ev.start, t)) / 60000;
  });
  return { show: min > 0 || dueEnd - t <= 7 * DAY, min: Math.round(min) };
}
function fmtHours(m) { return m < 60 ? m + "m" : (Math.round(m / 30) / 2) + "h"; }

function dueDayLabel(day, now) {
  var p = day.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
  var diff = Math.round((d.getTime() - startOfDay(now).getTime()) / DAY);
  if (diff === 0) return { text: "Today", soon: 0 };
  if (diff === 1) return { text: "Tmr", soon: 1 };
  if (diff < 7) return { text: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()], soon: 2 };
  return { text: (d.getMonth() + 1) + "/" + d.getDate(), soon: 3 };
}

// Which deadlines get a row when there's room for `max`. Never left out for space:
// anything due in the next 36 hours, and the next exam or quiz in the coming 10 days.
// Deadlines whose time already passed today go last (still shown, faded, if there's room).
function pickDue(list, now, max) {
  var t = now.getTime();
  var live = list.filter(function (d) { return dueEndOf(d) >= t; });
  var passed = list.filter(function (d) { return dueEndOf(d) < t; });
  var must = live.filter(function (d) { return dueEndOf(d) - t <= 36 * 3600000; });
  var exam = live.filter(function (d) { return isExam(d) && dueEndOf(d) - t <= 10 * DAY && must.indexOf(d) < 0; })[0];
  if (exam) must.push(exam);
  var rows = must.slice();
  live.forEach(function (d) { if (rows.length < Math.max(max, must.length) && rows.indexOf(d) < 0) rows.push(d); });
  passed.forEach(function (d) { if (rows.length < max) rows.push(d); });
  rows.sort(function (a, b) {
    var pa = dueEndOf(a) < t, pb = dueEndOf(b) < t;
    if (pa !== pb) return pa ? 1 : -1;
    return dueEndOf(a) - dueEndOf(b);
  });
  var hidden = live.filter(function (d) { return rows.indexOf(d) < 0; });
  return { rows: rows, hidden: hidden, next: hidden[0] || null };
}

// Today's timed events, without deadline markers or day-long background events.
function timedFor(events, date) {
  var s = startOfDay(date).getTime(), e = addDays(date, 1), seen = {}, out = [];
  events.forEach(function (ev) {
    if (ev.src === "canvas" || ev.allDay || ev.end <= s || ev.start >= e) return;
    var key = ev.title.toLowerCase() + "|" + ev.start;
    if (seen[key]) return; seen[key] = 1;
    if (isDeadline(ev) && ev.end - ev.start <= 30 * 60000) return;
    if (ev.src !== "study" && ev.end - ev.start >= 6 * 3600000 && !/^sleep\b/i.test(ev.title)) return;   // background, not a block
    out.push(ev);
  });
  return out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { isDeadline: isDeadline, isExam: isExam, buildDeadlines: buildDeadlines, pickDue: pickDue, dueKey: dueKey,
    timeInTitle: timeInTitle, plannedFor: plannedFor, timedFor: timedFor, sameDeadline: sameDeadline, dueEndOf: dueEndOf, dayKey: dayKey };
}
