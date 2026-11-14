// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: calendar-alt;
const Shorten = (function () { var module = { exports: {} };
/*
 * Title shortener for small displays.
 *
 * Calendar titles are written for a full calendar, not a 20-character screen.
 * shorten() turns one title into a list of versions, longest first, each a bit
 * more compact than the last. fit() then shows the longest version that fits
 * the element it's going into. Nothing is hard-coded per event.
 *
 * Steps it takes, in order:
 *   1. Clean: drop course codes in [brackets], "Week 6", "due …", underscores.
 *   2. Abbreviate common words (Reading -> Rdg, Exercise -> Ex, Lesson 4 -> L4).
 *   3. Drop asides in (parentheses) and filler words (the, of, to…).
 *   4. Drop a subtitle after ":" or " - ".
 *   5. For combined titles ("A · B"), keep the first part and count the rest.
 *   6. For lists ("a, b, c, d"), keep the first items and count the rest.
 * If even the shortest version doesn't fit, the element's own CSS ellipsis
 * cuts it at the edge.
 */
(function (root) {
  "use strict";

  // Multi-word phrases first, then single words. Matching ignores case.
  var PHRASES = [
    ["literature humanities", "Lit Hum"], ["university writing", "UW"], ["computer science", "CS"],
    ["problem sets", "Psets"], ["problem set", "Pset"], ["office hours", "OH"], ["advanced programming", "AP"],
    ["character practice", "Char Prac"], ["study session", "Study"]
  ];
  var WORDS = {
    assignment: "Asgmt", assignments: "Asgmts", homework: "HW", reading: "Rdg", readings: "Rdgs",
    exercise: "Ex", exercises: "Ex", practice: "Prac", character: "Char", characters: "Chars",
    laboratory: "Lab", report: "Rpt", introduction: "Intro", introductory: "Intro", economics: "Econ",
    physics: "Phys", chemistry: "Chem", biology: "Bio", mathematics: "Math", calculus: "Calc",
    chinese: "Chn", spanish: "Span", english: "Eng", history: "Hist", philosophy: "Phil",
    psychology: "Psych", statistics: "Stats", meeting: "Mtg", discussion: "Disc", presentation: "Pres",
    project: "Proj", review: "Rev", midterm: "Midterm", weekly: "Wkly", vocabulary: "Vocab",
    experiment: "Expt", experimental: "Expt", conference: "Conf", lecture: "Lec", recitation: "Rec",
    workshop: "Wkshp", hackathon: "Hack", appointment: "Appt", application: "App", applications: "Apps",
    feedback: "Fdbk", software: "SW", flight: "Flt", colleges: "Colleges", concert: "Concert",
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
    and: "+"
  };
  // "Lesson 4" -> "L4", "Chapter 3" -> "Ch3", "Part II" -> "Pt II"
  var NUMBERED = [
    [/\blessons?\s*#?\s*(\d+)\b/gi, "L$1"], [/\bchapters?\s*#?\s*(\d+)\b/gi, "Ch$1"],
    [/\bunits?\s*#?\s*(\d+)\b/gi, "U$1"], [/\bmodules?\s*#?\s*(\d+)\b/gi, "M$1"],
    [/\bpart\s+([ivx]+|\d+[a-z]?)\b/gi, "Pt $1"], [/\bproblem\s+set\s*#?\s*(\d+)\b/gi, "Pset $1"],
    [/\bquestions?\s*#?\s*(\d+)\b/gi, "Q$1"]
  ];
  var FILLER = { the: 1, a: 1, an: 1, of: 1, "for": 1, to: 1, with: 1, on: 1, "in": 1, at: 1, my: 1, your: 1 };
  var COURSES = [
    [/chinese/i, "Chn"], [/writing/i, "UW"], [/phys/i, "Phys"], [/econ/i, "Econ"],
    [/literature|lit\s*hum/i, "Lit Hum"], [/programming|computer|\bcs\b/i, "CS"],
    [/intro(duction)? to comp|computing|engi\s*\d/i, "Comp"], [/discrete/i, "Discrete"], [/math|calc|algebra/i, "Math"], [/chem/i, "Chem"], [/bio/i, "Bio"], [/spanish/i, "Span"], [/history/i, "Hist"]
  ];

  function squash(s) { return String(s).replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim(); }

  /** Short course label from a Canvas-style "[CODE - Course Name]" bracket, if recognizable. */
  function courseTag(title) {
    var m = /\[([^\]]+)\]/.exec(String(title));
    if (!m) return "";
    for (var i = 0; i < COURSES.length; i++) if (COURSES[i][0].test(m[1])) return COURSES[i][1];
    return "";
  }

  function clean(title) {
    var s = String(title || "");
    var tag = courseTag(s);
    s = s.replace(/\[[^\]]*\]/g, " ")                               // course codes, [Fall 2026]
      .replace(/_/g, " ")
      .replace(/\bweek\s*\d+\b/gi, " ")                               // "Week 6"
      .replace(/\(\s*(see description|optional|tentative)\s*\)/gi, " ")
      .replace(/\(\s*due[^)]*\)/gi, " ")                              // "(due Sun)"
      .replace(/\bdue\b(\s+\d{1,2}(:\d{2})?\s*(am|pm))?:?/gi, " ")    // "due 6 PM", "due:"
      .replace(/\s+([:,])/g, "$1").replace(/^[\s:·,–-]+|[\s:·,–-]+$/g, "");
    s = squash(s);
    if (tag && s.toLowerCase().indexOf(tag.toLowerCase()) < 0) {
      var full = { Chn: "chinese", UW: "writing", Phys: "phys", Econ: "econ", "Lit Hum": "lit hum", CS: "cs" }[tag];
      if (!full || s.toLowerCase().indexOf(full) < 0) s = tag + " " + s;
    }
    return s;
  }

  function matchCase(src, out) {
    if (src === src.toUpperCase() && /[A-Z]/.test(src) && src.length > 1) return out.toUpperCase();
    return out;
  }

  function abbreviate(s, keepCommas) {
    NUMBERED.forEach(function (r) { s = s.replace(r[0], r[1]); });
    PHRASES.forEach(function (p) {
      s = s.replace(new RegExp("\\b" + p[0].replace(/ /g, "\\s+") + "\\b", "gi"), function (m) { return matchCase(m, p[1]); });
    });
    s = s.replace(/[A-Za-z]+/g, function (w) {
      var a = WORDS[w.toLowerCase()];
      return a ? matchCase(w, a) : w;
    });
    s = s.replace(/#\s*(\d)/g, "$1").replace(/\s*&\s*/g, "+").replace(/\s*\+\s*/g, "+")
      .replace(/(\d)\s*\+\s*(\d)/g, "$1+$2");
    return squash(keepCommas ? s : s.replace(/,(?=\s)/g, ""));
  }

  function isCourseLabel(s) {
    var t = s.trim();
    if (t.length <= 8) return true;
    return COURSES.some(function (c) { return c[0].test(t) && t.split(" ").length <= 2; });
  }

  function dropFiller(s) {
    s = s.replace(/\([^)]*\)/g, " ");
    var words = squash(s).split(" ");
    var kept = words.filter(function (w, i) { return (i === 0 && words.length < 3) || !FILLER[w.toLowerCase()]; });
    return squash(kept.join(" "));
  }

  // "Econ reading: Trade and Macro" -> "Econ reading". A course label before
  // the colon ("Lit Hum: Agamemnon") is kept with what follows instead.
  function dropSubtitle(s) {
    var m = /^(.+?)(?::\s|\s[-–—]\s)(.+)$/.exec(s);
    if (!m) return s;
    if (isCourseLabel(m[1])) return squash(m[1] + " " + m[2]);
    if (m[1].split(" ").length < 2) return s;
    return squash(m[1]);
  }

  function joinSegments(s) { return s.replace(/\s·\s/g, " "); }

  function firstSegment(s) {
    var parts = s.split(/\s·\s/);
    if (parts.length < 2) return s;
    return parts[0] + " +" + (parts.length - 1);
  }

  function dropYears(s) { return squash(s.replace(/\b(19|20)\d\d\b/g, " ")); }

  /** Every version of a title, longest first, each shorter than the one before. */
  function shorten(title) {
    var base = clean(title);
    var steps = [base];
    var a = abbreviate(base); steps.push(a);
    var b = dropFiller(a); steps.push(b);
    var c = dropSubtitle(b); steps.push(c);
    steps.push(joinSegments(c));
    var d = dropYears(firstSegment(c)); steps.push(d);
    steps.push(dropSubtitle(d));
    var out = [];
    steps.forEach(function (v) {
      v = squash(v);
      if (v && (!out.length || v.length < out[out.length - 1].length)) out.push(v);
    });
    return out.length ? out : [String(title || "")];
  }

  /** Versions of a step line: the full line, then comma lists cut to their first items. */
  function shortenStep(step) {
    var s = squash(step);
    var out = [s];
    var push = function (v) { v = squash(v); if (v && v.length < out[out.length - 1].length) out.push(v); };
    var a = abbreviate(s, true);
    push(a);
    // "do X; then Y" -> "do X"
    if (/;\s/.test(a)) { a = a.split(/;\s*/)[0]; push(a); push(dropFiller(a)); }
    var m = /^(\S+\s+)?(.+)$/.exec(a);
    var lead = m && m[1] && /^(write|read|do|finish|start|review|make|run|get|check|build|submit|paste|uncomment|fix|test|add)\s$/i.test(m[1]) ? m[1] : "";
    var items = (lead ? m[2] : a).split(/\s*,\s*|\s+and\s+|\+(?!\s*\d)/i).filter(Boolean);
    if (items.length > 1) {
      for (var k = items.length - 1; k >= 1; k--) push(lead + items.slice(0, k).join(", ") + " +" + (items.length - k));
      if (lead) push(items[0] + " +" + (items.length - 1));
    } else {
      push(dropFiller(a));
    }
    return out;
  }

  /** Shows the longest version that fits el's width. Needs el to have a fixed or flex-limited width. */
  function fit(el, versions) {
    if (!el) return;
    for (var i = 0; i < versions.length; i++) {
      el.textContent = versions[i];
      if (el.scrollWidth <= el.clientWidth + 1) return versions[i];
    }
    return versions[versions.length - 1];
  }

  /** Same idea for a fixed character budget (monospace screens, tests). */
  function fitChars(versions, n) {
    for (var i = 0; i < versions.length; i++) if (versions[i].length <= n) return versions[i];
    var last = versions[versions.length - 1];
    return last.slice(0, Math.max(1, n - 1)).replace(/\s+\S*$/, "") + "…";
  }

  var api = { shorten: shorten, shortenStep: shortenStep, fit: fit, fitChars: fitChars, clean: clean, courseTag: courseTag };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Shorten = api;
})(this);

return module.exports; })();

/* ---------- Calendar rules (site/rules.js) ---------- */
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


// Desk Board widget for Scriptable (iPhone, and the Mac desktop through iPhone widgets).
// Shows the block you're in or the next one, its first step, and what's due.
// Run it once inside Scriptable to connect it, then add it as a widget.

/* ---------- Look ---------- */
const C = {
  lcdTop: new Color("#cfe6c8"), lcdBottom: new Color("#b3d2ac"),
  ink: new Color("#15301b"), soft: new Color("#15301b", 0.62), faint: new Color("#15301b", 0.35),
  alert: new Color("#9a3a1c"), bar: new Color("#15301b"), barText: new Color("#dff0d8")
};
// Jersey 10 and Silkscreen are used when they're installed on the phone (see README).
// Without them the widget uses SF Mono, which is wider, so titles get shortened more.
let PIXEL_FONTS = false;
const px = (size) => (PIXEL_FONTS ? new Font("Jersey10-Regular", size) : Font.boldMonospacedSystemFont(size * 0.8));
const lb = (size) => (PIXEL_FONTS ? new Font("Silkscreen-Regular", size) : Font.semiboldMonospacedSystemFont(size));
/** How many characters fit in `width` points at a pixel-font `size`. */
const fits = (width, size) => Math.max(6, Math.floor(width / (size * (PIXEL_FONTS ? 0.38 : 0.8 * 0.62))));

/* ---------- Connection ---------- */
const KC = "deskboard.config";

function parseLink(text) {
  text = String(text || "").trim();
  const hash = text.indexOf("#") >= 0 ? text.slice(text.indexOf("#") + 1) : "";
  const q = {};
  hash.split("&").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
  if (q.u && q.k) return { url: q.u, key: q.k, page: text };
  return null;
}

function readConfig() {
  try { return Keychain.contains(KC) ? JSON.parse(Keychain.get(KC)) : null; } catch (e) { return null; }
}

async function askConfig(old) {
  const a = new Alert();
  a.title = "Connect Desk Board";
  a.message = "Paste the phone link from the board's setup sheet (Copy phone link). Or leave it blank and fill in the script URL and key.";
  a.addTextField("Phone link", old && old.page || "");
  a.addTextField("Script URL (…/exec)", old && old.url || "");
  a.addTextField("Board key", old && old.key || "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.present() < 0) return old;
  const fromLink = parseLink(a.textFieldValue(0));
  const cfg = fromLink || { url: a.textFieldValue(1).trim(), key: a.textFieldValue(2).trim(), page: "" };
  cfg.pixelFonts = !!(old && old.pixelFonts);
  if (!cfg.url || !cfg.key) return old;
  Keychain.set(KC, JSON.stringify(cfg));
  return cfg;
}

/* ---------- Data ---------- */
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "deskboard-cache.json");

async function fetchData(cfg) {
  try {
    const sep = cfg.url.indexOf("?") >= 0 ? "&" : "?";
    const req = new Request(cfg.url + sep + "action=data&key=" + encodeURIComponent(cfg.key));
    req.timeoutInterval = 20;
    const d = await req.loadJSON();
    if (!d || !d.ok) throw new Error(d && d.error === "unauthorized" ? "Wrong board key" : "Script error");
    fm.writeString(CACHE, JSON.stringify(d));
    return { data: d, stale: false };
  } catch (e) {
    if (fm.fileExists(CACHE)) return { data: JSON.parse(fm.readString(CACHE)), stale: true, error: String(e.message || e) };
    return { data: null, stale: true, error: String(e.message || e) };
  }
}

/* ---------- Calendar rules ----------
   Deadlines, dates and work planned come from rules.js (inlined above by build.sh),
   the same file the phone board, desktop board and calendar script use. */

function stepsFrom(text) {
  const out = [];
  // "- step" and "- [ ] step" are open; "- [x] step" is done and left out.
  text.split(/\n/).forEach((line) => {
    const m = /^\s*(?:[-•*·]|\d+[.)])\s+(?:\[([ xX]?)\]\s*)?(.+)/.exec(line) || /^\s*()\[([ xX]?)\]\s+(.+)/.exec(line);
    if (!m) return;
    const box = m.length > 3 ? m[2] : m[1], txt = (m.length > 3 ? m[3] : m[2]).trim();
    if (!txt || /x/i.test(box || "")) return;
    const dg = /^digest\s*:\s*/i.exec(txt);
    out.push(dg ? "◇ " + txt.slice(dg[0].length) : txt);   // ◇ marks a digest step
  });
  return out.slice(0, 6);
}
/** "> step" or "◇ digest step", shortened to n characters. */
function stepLine(s, n) {
  const dig = s.indexOf("◇ ") === 0, body = dig ? s.slice(2) : s;
  return (dig ? "◇ " : "> ") + Shorten.fitChars(Shorten.shortenStep(body), n);
}
function parseEvents(list) {
  return (Array.isArray(list) ? list : []).map((e) => {
    const allDay = !!e.allDay;
    let start, end;
    if (allDay) { start = localDate(e.startDate); end = e.endDate ? localDate(e.endDate) : start + DAY; }
    else { start = Number(e.start); end = Number(e.end); }
    const text = plainText(e.desc);
    return {
      id: String(e.id || ""), src: String(e.cal || "primary"), title: String(e.title || "Busy"), where: String(e.where || ""),
      allDay, start, end, steps: e.cal === "canvas" ? [] : stepsFrom(text), modes: e.cal === "canvas" ? [] : modesFrom(text)
    };
  }).filter((e) => !isNaN(e.start) && !isNaN(e.end));
}

// A block with no steps written still gets a first move, so steps are optional.
const DEFAULT_STEP = "Open it and do one 25-min round";
function stepsOrDefault(ev) {
  if (ev.steps.length) return ev.steps;
  if (ev.src === "study" && !/\b(eat|break|lunch|dinner|breakfast|commute|sleep)\b/i.test(ev.title)) return [DEFAULT_STEP];
  return ev.where ? [ev.where] : [];
}

/** What the widget shows at `now`: the card, the due rows, and when to redraw next. */
function model(data, now) {
  const events = parseEvents(data.events);
  const t = now.getTime();
  const today = timedFor(events, now);
  const cur = today.filter((i) => i.start <= t && i.end > t).sort((a, b) => b.start - a.start)[0];
  const upcoming = today.filter((i) => i.start > t);
  const next = upcoming[0];
  let card;
  if (cur) {
    card = { label: "Now", title: cur.title, meta: "Until " + clockShort(cur.end) + " · " + fmtDur(cur.end - t) + " left",
      pre: "Until " + clockShort(cur.end) + " · ", count: new Date(cur.end), post: " left",
      modes: cur.modes, steps: stepsOrDefault(cur), progress: Math.min(1, (t - cur.start) / (cur.end - cur.start)) };
  } else if (next) {
    card = { label: "Next", title: next.title, meta: clockShort(next.start) + " · in " + fmtDur(next.start - t), steps: stepsOrDefault(next), modes: next.modes,
      pre: clockShort(next.start) + " · in ", count: new Date(next.start), post: "" };
  } else {
    const first = timedFor(events, new Date(addDays(now, 1, 1))).filter((i) => !/^sleep\b/i.test(i.title))[0];
    card = first
      ? { label: "Tomorrow", title: first.title, meta: "Starts " + clockShort(first.start), steps: first.steps, modes: first.modes }
      : { label: "Tomorrow", title: "Nothing planned yet", meta: "Plan it tonight", steps: [] };
  }
  const later = upcoming.slice(cur ? 0 : 1, (cur ? 0 : 1) + 2).map((i) => clockShort(i.start) + " " + Shorten.fitChars(Shorten.shorten(i.title), 14));

  // Deadlines marked done on any board are left out (same keys everywhere).
  const doneDue = (data.state && data.state.doneDue) || {};
  const all = buildDeadlines(events, now).filter((d) => !doneDue[dueKey(d)]);
  // Only the most urgent deadline with no time planned gets the warning.
  const warnD = all.filter((d) => { if (dueEndOf(d) < t) return false; const p = plannedFor(events, d, now); return p.show && !p.min; })[0];
  const row = (d) => {
    const lab = dueDayLabel(d.day, now), plan = plannedFor(events, d, now), past = dueEndOf(d) < t;
    const bits = [];
    if (past) bits.push("passed");
    else {
      if (d.dueAt && lab.soon <= 1) bits.push(clockShort(d.dueAt));
      if (plan.min) bits.push(fmtHours(plan.min)); else if (d === warnD) bits.push("0h");
    }
    return { day: lab.text, soon: lab.soon, raw: d.raw || d.title, meta: bits.join(" · "), unplanned: d === warnD, past };
  };
  // Rows for a widget with room for `max`: never leaves out what's due in 36 hours or the next exam.
  const pick = (max) => {
    const p = pickDue(all, now, max);
    return { rows: p.rows.map(row), more: p.hidden.length, next: p.next ? dueDayLabel(p.next.day, now).text : "" };
  };
  const soonCount = all.filter((d) => dueEndOf(d) >= t && dueDayLabel(d.day, now).soon <= 1).length;

  // Say so when what's shown might be missing something.
  const src = data.sources || {};
  const age = t - Number(data.now || t);
  const alert = age > 3 * 3600000 ? "Not updated since " + clockShort(Number(data.now)) + ": deadlines may be missing"
    : Object.keys(src).some((k) => src[k] && src[k].ok === false && k !== "sleep") ? "A calendar didn't load: deadlines may be missing" : "";

  const pomos = Number((data.state && data.state.log && data.state.log[dayKey(now)]) || 0);

  // Redraw when the current block ends or the next one starts, and at least every 15 minutes.
  const marks = [];
  if (cur) marks.push(cur.end);
  if (next) marks.push(next.start);
  marks.push(addDays(now, 1) + 60000);
  const soonest = Math.min.apply(null, marks.filter((m) => m > t).concat([t + 15 * 60000]));
  return { card, later, pick, soonCount, alert, pomos, refresh: new Date(soonest + 30000) };
}

/* ---------- Drawing ---------- */
const UP = (s) => String(s).toUpperCase();

function text(stack, s, font, color, lines) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color || C.ink; t.lineLimit = lines || 1; t.minimumScaleFactor = 0.75;
  return t;
}

function labelRow(stack, left, right) {
  const row = stack.addStack(); row.layoutHorizontally(); row.centerAlignContent();
  text(row, UP(left), lb(9), C.soft);
  row.addSpacer();
  if (right) text(row, UP(right), lb(9), C.soft);
}

function progressBar(stack, frac, width) {
  const cells = 10, gap = 2, w = (width - gap * (cells - 1)) / cells, lit = Math.round(frac * 10);
  const row = stack.addStack(); row.layoutHorizontally(); row.spacing = gap;
  for (let i = 0; i < cells; i++) {
    const c = row.addStack(); c.size = new Size(w, 5);
    c.backgroundColor = i < lit ? C.ink : new Color("#15301b", 0.13);
  }
}

/** "Until 10:30p · 22:59 left": the countdown ticks on its own between widget refreshes. */
function metaLine(stack, c, font, color) {
  if (!c.count) { const t = stack.addText(UP(c.meta)); t.font = font; t.textColor = color; t.lineLimit = 1; return; }
  const row = stack.addStack(); row.layoutHorizontally(); row.spacing = 0;
  const a = row.addText(UP(c.pre)); a.font = font; a.textColor = color; a.lineLimit = 1;
  const d = row.addDate(c.count); d.applyTimerStyle(); d.font = font; d.textColor = color; d.lineLimit = 1;
  if (c.post) { const b = row.addText(UP(c.post)); b.font = font; b.textColor = color; b.lineLimit = 1; }
  row.addSpacer();
}

function card(stack, m, opts) {
  const modes = m.card.modes || [];
  labelRow(stack, m.card.label, opts.width >= 300 ? modes.map((k) => k + " " + PACER[k].short).join(" · ") : modes.join("·"));
  stack.addSpacer(2);
  const tc = fits(opts.width, opts.titleSize), lines = opts.titleLines || 1;
  const versions = Shorten.shorten(m.card.title);
  // Prefer a version that fits on one line; use the second line only when that would cut too much.
  const one = versions.filter((v) => v.length <= tc)[0];
  const title = one && (lines === 1 || one.length >= versions[0].length * 0.6) ? one : Shorten.fitChars(versions, tc * lines);
  text(stack, UP(title), px(opts.titleSize), C.ink, lines);
  metaLine(stack, m.card, px(opts.metaSize), C.soft);
  if (m.card.progress != null && opts.bar) { stack.addSpacer(3); progressBar(stack, m.card.progress, opts.bar); }
  const steps = m.card.steps.slice(0, opts.steps);
  if (steps.length) stack.addSpacer(3);
  steps.forEach((s, i) => {
    text(stack, UP(stepLine(s, fits(opts.width, opts.stepSize) - 2)), px(i ? opts.stepSize - 1 : opts.stepSize), i ? C.soft : C.ink);
  });
}

function dueList(stack, m, max, size, width) {
  const p = m.pick(max);
  labelRow(stack, "Due", p.more ? "+" + p.more + " more · next " + p.next : "");
  stack.addSpacer(2);
  if (m.alert) { text(stack, UP(m.alert), lb(8), C.alert, 2); stack.addSpacer(2); }
  if (!p.rows.length) { text(stack, UP("Nothing due in the next 6 weeks"), px(size), C.soft); return; }
  p.rows.forEach((d) => {
    const row = stack.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 5;
    row.setPadding(1, 3, 1, 3);
    const hot = d.soon === 0 && !d.past;
    if (hot) { row.backgroundColor = C.bar; row.cornerRadius = 2; }
    const fg = hot ? C.barText : C.ink;
    const cells = [];
    const day = text(row, UP(d.day), px(size), fg); day.minimumScaleFactor = 1; cells.push(day);
    cells.push(text(row, UP(Shorten.fitChars(Shorten.shorten(d.raw), fits(width, size) - 4 - d.day.length - d.meta.length)), px(size), fg));
    row.addSpacer();
    if (d.meta) cells.push(text(row, UP(d.meta), px(size), d.unplanned ? (hot ? new Color("#f2c9a8") : C.alert) : (hot ? C.barText : C.soft)));
    if (d.past) cells.forEach((c) => { c.textOpacity = 0.45; });
  });
}

function baseWidget(cfg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.lcdTop, C.lcdBottom]; g.locations = [0, 1];
  w.backgroundGradient = g;
  if (cfg && cfg.page) w.url = cfg.page;
  return w;
}

function footer(stack, m, res) {
  const parts = [];
  parts.push(m.pomos ? m.pomos + " pomodoro" + (m.pomos > 1 ? "s" : "") + " today" : "No pomodoros yet");
  parts.push(res.stale ? "offline" : "updated " + clockShort(Date.now()));
  text(stack, UP(parts.join(" · ")), lb(8), C.faint);
}

function build(family, m, res, cfg) {
  const w = baseWidget(cfg);
  w.refreshAfterDate = m.refresh;

  if (family === "accessoryInline") {
    w.addText(m.card.label + ": " + Shorten.fitChars(Shorten.shorten(m.card.title), 22));
    return w;
  }
  if (family === "accessoryCircular") {
    const soon = m.soonCount;
    w.addSpacer();
    const n = w.addText(String(soon)); n.font = Font.boldRoundedSystemFont(22); n.centerAlignText();
    const l = w.addText("DUE"); l.font = Font.systemFont(9); l.centerAlignText();
    w.addSpacer();
    return w;
  }
  if (family === "accessoryRectangular") {
    metaLine(w, Object.assign({}, m.card, { pre: m.card.label + " · " + (m.card.pre || ""), meta: m.card.label + " · " + m.card.meta }), Font.semiboldSystemFont(11), Color.white());
    const t = w.addText(Shorten.fitChars(Shorten.shorten(m.card.title), 24)); t.font = Font.boldSystemFont(14); t.lineLimit = 1;
    const s = m.card.steps[0];
    const third = s ? stepLine(s, 26)
      : (m.pick(1).rows[0] ? (function (d) { return d.day + " " + Shorten.fitChars(Shorten.shorten(d.raw), 18) + " " + d.meta; })(m.pick(1).rows[0]) : "");
    if (third) { const x = w.addText(third); x.font = Font.systemFont(12); x.lineLimit = 1; }
    return w;
  }

  if (family === "small") {
    w.setPadding(12, 12, 12, 12);
    card(w, m, { width: 146, titleSize: 20, titleLines: 2, metaSize: 13, steps: 1, stepSize: 14, bar: 0 });
    w.addSpacer();
    if (m.alert) { text(w, UP(m.alert), lb(7), C.alert, 2); return w; }
    const d = m.pick(1).rows[0];
    if (d) {
      const row = w.addStack(); row.layoutHorizontally(); row.spacing = 4;
      text(row, UP(d.day), px(13), C.soft);
      text(row, UP(Shorten.fitChars(Shorten.shorten(d.raw), fits(146, 13) - 8)), px(13), C.ink);
      row.addSpacer();
      if (d.meta) text(row, UP(d.meta.split(" · ").pop()), px(13), d.unplanned ? C.alert : C.soft);
    }
    return w;
  }

  if (family === "medium") {
    w.setPadding(12, 14, 12, 14);
    const row = w.addStack(); row.layoutHorizontally(); row.spacing = 14; row.topAlignContent();
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(150, 0);
    card(left, m, { width: 150, titleSize: 20, titleLines: 2, metaSize: 13, steps: 3, stepSize: 14, bar: 150 });
    left.addSpacer();
    const right = row.addStack(); right.layoutVertically();
    dueList(right, m, 3, 15, 170);
    right.addSpacer();
    return w;
  }

  // large / extraLarge
  w.setPadding(16, 16, 14, 16);
  card(w, m, { width: 300, titleSize: 26, titleLines: 1, metaSize: 15, steps: 4, stepSize: 16, bar: 300 });
  if (m.later.length) { w.addSpacer(4); text(w, UP("Later: " + m.later.join(" · ")), px(14), C.soft); }
  w.addSpacer(10);
  dueList(w, m, 5, 16, 300);
  w.addSpacer();
  footer(w, m, res);
  return w;
}

function message(cfg, title, body) {
  const w = baseWidget(cfg);
  w.setPadding(14, 14, 14, 14);
  text(w, UP("Desk Board"), lb(9), C.soft);
  w.addSpacer(4);
  text(w, UP(title), px(18), C.ink, 2);
  if (body) text(w, body, px(13), C.soft, 3);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  return w;
}

/* ---------- Notifications ---------- */
// Few on purpose (reminders stop working when there are many of them):
// "Head to Library" 10 minutes before a block only when you need to move, and "Start"
// only for the first block of the day. Nothing fires while a focus round is running.
const NUDGE = "deskboard-";

async function scheduleNudges(data, cfg) {
  const now = Date.now(), horizon = now + 24 * 3600000;
  const blocksOn = !(cfg && cfg.nudges === false);   // "Turn off block notifications" leaves deadline reminders on
  const blocks = parseEvents(data.events).filter(() => blocksOn)
    .filter((e) => e.src === "study" && !e.allDay && e.end - e.start >= 20 * 60000)
    .sort((a, b) => a.start - b.start);
  const want = [];
  blocks.forEach((blk, i) => {
    let b = blk;
    if (b.start > horizon) return;
    const prev = blocks[i - 1];
    const fromSamePlace = prev && prev.where === b.where && b.start - prev.end <= 20 * 60000;
    // The first block of the day at the dorm needs no "head to": that's where you wake up.
    const firstOfDay = !prev || dayKey(prev.start) !== dayKey(b.start);
    if (/dorm/i.test(b.where) && firstOfDay) b = Object.assign({}, b, { where: "" });
    const first = b.steps[0];
    if (b.where && !fromSamePlace && b.start - 10 * 60000 > now) {
      want.push({ id: NUDGE + "move-" + b.id + "-" + b.start, at: b.start - 10 * 60000,
        title: "Head to " + b.where.replace(/\s*\(.*\)$/, ""), body: b.title + " starts at " + clockShort(b.start) + "." });
    }
    if (b.start > now && firstOfDay) {
      want.push({ id: NUDGE + "start-" + b.id + "-" + b.start, at: b.start,
        title: "Start: " + b.title,
        body: "First: " + (first ? first.replace(/^◇ /, "") : DEFAULT_STEP) + "." +
          (b.modes && b.modes.length ? "\nAfter each round: " + b.modes.slice(0, 2).map((k) => PACER[k].verb).join(", ") + "." : "") });
    }
  });
  const timer = data.state && data.state.timer;
  const focusUntil = timer && timer.phase === "focus" && typeof timer.endAt === "number" ? timer.endAt : 0;
  const quiet = want.filter((w) => !(w.at < focusUntil));
  want.length = 0; quiet.forEach((w) => want.push(w));
  dueNudges(data, now, horizon).forEach((w) => want.push(w));   // deadline reminders are never held back
  try {
    const pending = await Notification.allPending();
    const ours = pending.map((n) => n.identifier).filter((id) => id && id.indexOf(NUDGE) === 0);
    if (ours.length) await Notification.removePending(ours);
    for (const w of want) {
      const n = new Notification();
      n.identifier = w.id; n.threadIdentifier = "deskboard";
      n.title = w.title; n.body = w.body; n.sound = "default";
      if (cfg && cfg.page) n.openURL = cfg.page;
      n.setTriggerDate(new Date(w.at));
      await n.schedule();
    }
  } catch (e) { /* notifications are a bonus; never break the widget over them */ }
}

// Deadline reminders: the evening before (20:00) and the morning of (09:15), plus 3 days
// ahead for exams and quizzes. Only when something is due, so there are few of them.
function dueNudges(data, now, horizon) {
  const events = parseEvents(data.events), doneDue = (data.state && data.state.doneDue) || {};
  const list = buildDeadlines(events, new Date(now)).filter((d) => !doneDue[dueKey(d)] && dueEndOf(d) > now);
  const name = (d) => Shorten.fitChars(Shorten.shorten(d.raw || d.title), 34) + (d.dueAt ? " " + clockShort(d.dueAt) : "");
  const out = [];
  [0, 1].forEach((n) => {
    const day = addDays(now, n), key = dayKey(day);
    const morning = addDays(now, n, 9) + 15 * 60000, evening = addDays(now, n, 20);
    // The morning one only lists what's still ahead by then; earlier ones got the evening reminder.
    const today = list.filter((d) => d.day === key && dueEndOf(d) > morning + 30 * 60000);
    const tomorrow = list.filter((d) => d.day === dayKey(addDays(now, n + 1, 12)));
    const in3 = list.filter((d) => d.day === dayKey(addDays(now, n + 3, 12)) && isExam(d));
    if (today.length && morning > now && morning <= horizon)
      out.push({ id: NUDGE + "due-am-" + key, at: morning, title: "Due today", body: today.map(name).join("\n") });
    const early = tomorrow.some((d) => d.dueAt && new Date(d.dueAt).getHours() < 11);
    if (tomorrow.length && evening > now && evening <= horizon)
      out.push({ id: NUDGE + "due-pm-" + key, at: evening, title: early ? "Due tomorrow, some in the morning" : "Due tomorrow", body: tomorrow.map(name).join("\n") });
    if (in3.length && evening > now && evening <= horizon)
      out.push({ id: NUDGE + "exam-" + key, at: evening + 60000, title: "In 3 days",
        body: in3.map((d) => { const p = plannedFor(events, d, new Date(now)); return name(d) + (p.min ? " · " + fmtHours(p.min) + " planned" : " · no time planned yet"); }).join("\n") });
  });
  return out;
}

/* ---------- Run ---------- */
async function render(family, cfg) {
  if (!cfg) return message(null, "Not connected", "Open Scriptable and run Desk Board once.");
  const res = await fetchData(cfg);
  if (!res.data) return message(cfg, "Can't reach your calendar", res.error);
  if (!res.stale) await scheduleNudges(res.data, cfg);
  return build(family, model(res.data, new Date()), res, cfg);
}

let cfg = readConfig();
PIXEL_FONTS = !!(cfg && cfg.pixelFonts);
if (config.runsInWidget) {
  Script.setWidget(await render(config.widgetFamily || "medium", cfg));
} else {
  if (!cfg) cfg = await askConfig(null);
  const menu = new Alert();
  menu.title = "Desk Board";
  menu.message = PIXEL_FONTS ? "Using Jersey 10 (installed fonts)." : "Using the system font.";
  ["Preview small", "Preview medium", "Preview large", "Change connection",
    PIXEL_FONTS ? "Use system font" : "Use Jersey 10 (fonts installed)",
    cfg && cfg.nudges === false ? "Turn on block notifications" : "Turn off block notifications"].forEach((x) => menu.addAction(x));
  menu.addCancelAction("Done");
  const pick = await menu.present();
  if (pick === 3) { cfg = await askConfig(cfg); }
  else if (pick === 4 && cfg) { cfg.pixelFonts = !PIXEL_FONTS; Keychain.set(KC, JSON.stringify(cfg)); }
  else if (pick === 5 && cfg) {
    cfg.nudges = cfg.nudges === false;
    Keychain.set(KC, JSON.stringify(cfg));
    if (!cfg.nudges) {
      const ours = (await Notification.allPending()).map((n) => n.identifier).filter((id) => id && id.indexOf(NUDGE) === 0);
      if (ours.length) await Notification.removePending(ours);
    } else {
      const res = await fetchData(cfg);
      if (res.data) await scheduleNudges(res.data, cfg);
    }
  }
  else if (pick >= 0) {
    const fam = ["small", "medium", "large"][pick];
    const w = await render(fam, cfg);
    if (fam === "small") await w.presentSmall(); else if (fam === "medium") await w.presentMedium(); else await w.presentLarge();
  }
}
Script.complete();
