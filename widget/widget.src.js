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
