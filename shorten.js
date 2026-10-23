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
    [/math|calc/i, "Math"], [/chem/i, "Chem"], [/bio/i, "Bio"], [/spanish/i, "Span"], [/history/i, "Hist"]
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
    var items = (lead ? m[2] : a).split(/\s*,\s*|\s+and\s+/i).filter(Boolean);
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
