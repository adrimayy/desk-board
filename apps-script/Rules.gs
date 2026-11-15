// Generated from site/rules.js by build.sh. Paste into Apps Script as a file named Rules.
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
// The last kind word wins: "Lab Report 7" is a report, "Final Essay 3" an essay.
function kindOf(title) { var k = null; String(title).toLowerCase().replace(/\[[^\]]*\]/g, " ").split(/[^a-z]+/).forEach(function (w) { var x = KINDS[w] || KINDS[w.replace(/s$/, "")] || KINDS[w.replace(/es$/, "")]; if (x) k = x; }); return k; }
// Assignment numbers: "Essay 3", "PS6", "L4–L5", "WR5", "Lab 5a". Clock times ("due 6 PM", "18:00") aren't numbers of anything.
function idsOf(title) {
  var t = String(title).toLowerCase().replace(/\bdue\b.*$/, "").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  var out = [], re = /\b[a-z]{0,3}(\d{1,3})[a-z]?\b/g, m;
  while ((m = re.exec(t))) out.push(String(Number(m[1])));
  return out;
}
function sharesId(a, b) { var x = idsOf(a), y = idsOf(b); return x.some(function (v) { return y.indexOf(v) >= 0; }); }
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

// Short names your own blocks use for a Canvas course ("AP lab work" belongs to Advanced Programming).
var COURSE_ALIASES = [[/advanced programming/i, "ap"], [/university writing/i, "uw"], [/literature humanities|\blit hum/i, "lit hum"],
  [/economics|\bun 1105\b/i, "econ"], [/chinese/i, "chinese chn"], [/\bphys/i, "phys physics"], [/chemistry/i, "chem"],
  [/discrete/i, "discrete"], [/computing|python/i, "computing comp"], [/linear algebra/i, "lin alg"], [/music hum/i, "music"]];
function courseAliases(course) {
  return COURSE_ALIASES.filter(function (a) { return a[0].test(course || ""); }).map(function (a) { return a[1]; }).join(" ");
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
    return { title: parts.title, raw: e.title, course: parts.course, dueAt: dueAt, day: day, src: e.src, tok: tokens(parts.title + " " + parts.course + " " + courseAliases(parts.course)),
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
// Daily review decks (Anki, flashcards) are their own routine, not time toward an assignment.
var CARDS_RX = /\b(anki|flashcards?|decks?)\b/i;
// Course names and short forms: sharing only these says nothing about which assignment it is.
var COURSE_TOKENS = { ap: 1, uw: 1, lit: 1, hum: 1, econ: 1, economics: 1, chinese: 1, chn: 1, phys: 1, physics: 1, lab: 1, cs: 1,
  chem: 1, chemistry: 1, comp: 1, computing: 1, discrete: 1, math: 1, music: 1, pe: 1, advanced: 1, programming: 1, literature: 1,
  humanities: 1, principles: 1, elementary: 1, intermediate: 1, intro: 1, introduction: 1, general: 1, university: 1, writing: 1 };
var FILLER = { set: 1, sets: 1, work: 1, prep: 1, finish: 1, submit: 1, block: 1, session: 1, chapter: 1, chapters: 1, ch: 1, from: 1, with: 1 };
function stem(w) { return w.length > 4 ? w.replace(/(es|s)$/, "") : w; }
function specificWords(title, course) {
  var skip = tokens(course || ""), out = {};
  for (var w in tokens(title)) if (!GENERIC[w] && !COURSE_TOKENS[w] && !skip[w] && !/\d/.test(w) && w.length > 2 && !kindOf(w) && !FILLER[w]) out[stem(w)] = 1;
  return out;
}
// Does a work block belong to this deadline? It has to be the same course, and then clearly the
// same assignment:
//   - a shared specific word ("Aeneid", "character", "Hydrogen") says yes;
//   - different kinds of work ("reading" vs "lab"), or different specific words on both sides
//     ("character practice" vs "reading questions" for the same lesson), say no;
//   - otherwise a shared assignment number ("Essay 3", "PS6") or the same kind of work says yes.
// Anki and flashcard blocks only count toward a deadline that is itself about cards.
function sameWork(d, key, blockTitle) {
  if (shared(key, tokens(blockTitle)) < 1) return false;
  var dt = d.raw || d.title;
  if (CARDS_RX.test(blockTitle) && !CARDS_RX.test(dt)) return false;
  if (!sameIds(d.title, blockTitle)) return false;
  var sd = specificWords(d.title, d.course), sb = specificWords(blockTitle, "");
  if (shared(sd, sb) >= 1) return true;
  var kd = kindOf(dt), kb = kindOf(blockTitle);
  if (kd && kb && kd !== kb && !(ACCEPTS[kd] && ACCEPTS[kd][kb])) return false;
  if (Object.keys(sd).length && Object.keys(sb).length) return false;
  // One side names a kind of work, the other only something specific: not clearly the same thing.
  if ((kd && !kb && Object.keys(sb).length) || (kb && !kd && Object.keys(sd).length)) return false;
  if (sharesId(d.title, blockTitle)) return true;
  return !!(kd && kb);
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

/* ---------- Work timer (shared by the phone board and the desktop board) ----------
   Two modes. "flow" counts up from Start for as long as you work (15 minutes of Anki counts
   just like two hours of an essay); "pomo" runs 25-minute rounds with 5-minute breaks.
   Either way the minutes are logged to the day and to the Study block they were for. */
var TIMER_LEN = { focus: 25 * 60000, rest: 5 * 60000 };
function timerFresh(mode) { return { mode: mode === "pomo" ? "pomo" : "flow", phase: "focus", endAt: null, left: TIMER_LEN.focus, since: null, acc: 0, cap: null, blk: null, due: null }; }
function timerClean(x) {
  x = x || {};
  var num = function (v) { return typeof v === "number" && isFinite(v) ? v : null; };
  var t = timerFresh(x.mode);
  t.phase = x.phase === "rest" ? "rest" : "focus";
  t.endAt = num(x.endAt);
  t.left = typeof x.left === "number" ? Math.max(0, Math.min(x.left, TIMER_LEN.focus)) : (t.phase === "rest" ? TIMER_LEN.rest : TIMER_LEN.focus);
  t.since = num(x.since); t.acc = Math.max(0, num(x.acc) || 0); t.cap = num(x.cap);
  t.blk = x.blk && x.blk.id ? { cal: String(x.blk.cal || "study"), id: String(x.blk.id), start: Number(x.blk.start) } : null;
  t.due = timerDue(x.due);
  return t;
}
// The deadline a timer is for, when it was started from one (outside a Study block, or from its row).
function timerDue(d) {
  return d && d.key ? { key: String(d.key).slice(0, 200), title: String(d.title || "").slice(0, 120) } : null;
}
function timerRunning(p) { return p.mode === "flow" ? !!p.since : !!p.endAt; }
function flowElapsed(p, t) { return (p.acc || 0) + (p.since ? Math.max(0, t - p.since) : 0); }
function fmtMins(m) { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60 < 10 ? "0" : "") + (m % 60) + "m" : "") : m + "m"; }
// The big digits: counting up shows mm:ss for the first hour, then h:mm.
function timerText(p, t) {
  if (p.mode === "flow") {
    var ms = flowElapsed(p, t), m = Math.floor(ms / 60000);
    return m < 60 ? pad(m) + ":" + pad(Math.floor(ms / 1000) % 60) : pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }
  var left = p.endAt ? Math.max(0, p.endAt - t) : p.left, s = Math.ceil(left / 1000);
  return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
}
function timerLabel(p, t) {
  if (p.mode === "flow") {
    if (p.since) return flowElapsed(p, t) >= 3600000 ? "Working · h:mm" : "Working";
    return p.acc ? "Paused" : "Count up · ready";
  }
  var paused = !p.endAt && p.left < TIMER_LEN[p.phase];
  return (p.phase === "focus" ? "Focus · 25 min" : "Break · 5 min") + (p.endAt ? "" : paused ? " · paused" : "");
}
function timerButton(p) {
  if (p.mode === "flow") return p.since ? "Pause" : p.acc ? "Resume" : "Start";
  return p.endAt ? "Pause" : (!p.endAt && p.left < TIMER_LEN[p.phase]) ? "Resume" : "Start";
}
// Start or pause. `blk` is the Study block on now (if any), so the time is logged to it;
// `due` is the deadline it's for when you started it from one ({ key, title }).
function timerToggle(p, t, blk, due) {
  p = timerClean(p);
  if (!p.due && due && !timerRunning(p)) p.due = timerDue(due);
  if (p.mode === "flow") {
    if (p.since) { p.acc += Math.max(0, t - p.since); p.since = null; return p; }
    p.since = t;
    if (!p.blk && blk) p.blk = { cal: blk.src || "study", id: blk.id, start: blk.start };
    // A forgotten timer stops itself: 30 minutes after the block ends, or 2 hours in without a block.
    p.cap = blk ? Math.max(blk.end + 30 * 60000, t + 30 * 60000) : t + 2 * 3600000;
    return p;
  }
  if (p.endAt) { p.left = Math.max(0, p.endAt - t); p.endAt = null; } else p.endAt = t + p.left;
  return p;
}
// Count-up "Done": what to log, and a fresh timer.
function timerFinish(p, t) {
  p = timerClean(p);
  return { minutes: Math.round(flowElapsed(p, t) / 60000), block: p.blk, due: p.due, timer: timerFresh("flow") };
}
// Every second: a finished round or break moves on; a forgotten count-up pauses itself.
function timerTick(p, t) {
  if (p.mode === "flow") {
    if (p.since && p.cap && t >= p.cap) { var q = timerClean(p); q.acc += Math.max(0, q.cap - q.since); q.since = null; return { timer: q, autoPaused: true }; }
    return null;
  }
  if (!p.endAt || t < p.endAt) return null;
  var wasFocus = p.phase === "focus", ended = p.endAt;
  var next = timerFresh("pomo");
  if (wasFocus) { next.phase = "rest"; next.endAt = ended + TIMER_LEN.rest; next.left = TIMER_LEN.rest; }
  return { timer: next, ended: ended, wasFocus: wasFocus };
}

/* ---------- Free time ----------
   Between blocks the boards suggest a start on the most urgent thing: starred first, then
   whatever is due soonest (in the next two weeks). `starred(d)` is optional. */
function pickSuggestion(ds, now, starred) {
  var t = now.getTime();
  return ds.filter(function (d) { var e = dueEndOf(d); return e >= t && e - t < 14 * DAY; })
    .sort(function (a, b) {
      var sa = starred && starred(a) ? 0 : 1, sb = starred && starred(b) ? 0 : 1;
      return sa - sb || dueEndOf(a) - dueEndOf(b);
    })[0] || null;
}
// Is now a gap worth using? No timed event on, and the next one (if any today) 30+ minutes away.
// Returns { until } (null = nothing else today) or null when it isn't a gap.
var GAP_MIN = 30;
function freeGap(timed, t) {
  var real = timed.filter(function (i) { return !/^sleep\b/i.test(i.title); });
  if (real.some(function (i) { return i.start <= t && i.end > t; })) return null;
  var next = real.filter(function (i) { return i.start > t; })[0];
  if (next && next.start - t < GAP_MIN * 60000) return null;
  return { until: next ? next.start : null, next: next || null };
}

