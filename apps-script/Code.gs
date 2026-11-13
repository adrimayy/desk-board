/**
 * Desk Board backend (Google Apps Script).
 *
 * Reads your main calendar, this account's own calendar, Study Calendar, Classes, Sleep and the Canvas feed,
 * keeps the focus timer in sync between devices, and writes check-ins, ticked
 * steps and pomodoro counts back onto your Study Calendar blocks.
 *
 * Setup:
 *   1. Run setup() once from the editor, approve access, and copy the board key from the log.
 *   2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   3. Paste the web app URL and the key into the board's setup sheet.
 * After editing this file: Deploy > Manage deployments > edit > Version: New version.
 */

// Your main calendar. When the script runs on a different account than the one
// that owns your calendars, put that calendar's address here (it must be shared
// with the account running the script). Leave it blank to use this account's own.
var MAIN_CALENDAR = 'ar4918@columbia.edu';
var STUDY_NAME = /study/i;      // calendar that holds your work blocks
var CANVAS_NAME = /canvas/i;    // Canvas assignment feed
var CLASSES_NAME = /^classes$/i; // class schedule, if you keep it on its own calendar
var SLEEP_NAME = /^sleep$/i;     // your sleep calendar (protected time)
var PAST_DAYS = 7;              // history kept for follow-through stats
var FUTURE_DAYS = 15;           // how far ahead the schedule is read
var DEADLINE_DAYS = 45;         // how far ahead deadlines are read (exams weeks away included)
var DIGEST_HOUR = 20;           // evening email about tomorrow's deadlines; null turns it off (run setup() after changing)
// Optional: your Canvas calendar feed URL (Canvas → Calendar → Calendar Feed), saved as the script
// property CANVAS_ICS_URL. Read directly, new assignments show up within minutes instead of
// waiting for Google Calendar's own refresh of the subscribed calendar (which can take hours).
var CACHE_SECONDS = 60;
var WAKE_HOUR = 9;              // protected sleep: nothing is scheduled or moved
var BED_HOUR = 25;              // between BED_HOUR and WAKE_HOUR (24 = midnight, 25 = 1 AM); the Sleep calendar also counts
var STATS_DAYS = 21;            // how far back "how long things take" looks
var STUDY_CAP_HOURS = 6;        // new blocks never push a day's Study time past this
var SLACK_MINUTES = 90;         // and always leave this much free, awake time in the day
var SKIP_CHECK = /\b(eat|break|lunch|dinner|breakfast|commute|sleep|head to|weekly review)\b/i;

/* ---------- Entry points ---------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return ContentService.createTextOutput('Desk Board script is running.');
  if (!authorized_(p.key)) return json_({ ok: false, error: 'unauthorized' });
  var action = p.action || 'data';
  if (action === 'ping') return json_({ ok: true, now: Date.now() });
  if (action === 'data') {
    var stats = stats_();
    try { writeEstimates_(stats); } catch (err) { /* estimates are a bonus */ }
    var data = events_();
    return json_({ ok: true, now: Date.now(), tz: Session.getScriptTimeZone(), events: data.events, sources: data.sources, state: state_(), stats: stats });
  }
  return json_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad request' });
  }
  if (!authorized_(body.key)) return json_({ ok: false, error: 'unauthorized' });
  return json_(handle_(body));
}

function handle_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var out = route_(body);
    return out && out.ok ? touch_(out) : out;
  } finally {
    lock.releaseLock();
  }
}

// Any tap on any board counts as "still using it". Days with a tap also let unrated
// blocks count as done (no news is good news), so you never have to rate a good block.
function touch_(out) {
  var s = state_();
  s.lastActive = Date.now();
  s.active[Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')] = 1;
  saveState_(s);
  out.state = s;
  return out;
}

function route_(body) {
  {
    if (body.action === 'timer') {
      var s = state_();
      s.timer = cleanTimer_(body.timer);
      saveState_(s);
      return { ok: true, state: s };
    }
    if (body.action === 'pomoDone') return pomoDone_(body);
    if (body.action === 'checkin') return checkin_(body);
    if (body.action === 'step') return step_(body);
    if (body.action === 'reschedule') return reschedule_(body);
    if (body.action === 'dueDone') return dueDone_(body);
    if (body.action === 'layout') return layout_(body);
    if (body.action === 'plan') return plan_(body);
    if (body.action === 'reviewed') return reviewed_(body);
    if (body.action === 'reset') return reset_(body);
    if (body.action === 'active') return { ok: true };
    return { ok: false, error: 'unknown action' };
  }
}

/** Run once from the editor to create the access key and grant calendar access. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('BOARD_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('BOARD_KEY', key);
  }
  CacheService.getScriptCache().remove('calendarIds3');
  var names = calendars_().map(function (c) { return c.key + ': ' + c.cal.getName(); });
  Logger.log('Calendars found -> ' + names.join(' | '));
  Logger.log('Your board key: ' + key);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyDigest') ScriptApp.deleteTrigger(t); });
  if (DIGEST_HOUR != null) {
    ScriptApp.newTrigger('dailyDigest').timeBased().atHour(DIGEST_HOUR).everyDays(1).create();
    Logger.log('Evening deadline email: every day around ' + DIGEST_HOUR + ':00, only when something is due tomorrow.');
  }
  var src = events_().sources;
  Logger.log('Sources -> ' + JSON.stringify(src));
}

/* ---------- Calendars ---------- */

// Looking up every calendar by name is slow, so the IDs are remembered for 6 hours.
function calendars_() {
  var cache = CacheService.getScriptCache();
  var ids = null;
  try { ids = JSON.parse(cache.get('calendarIds3') || 'null'); } catch (err) { ids = null; }
  if (!ids) {
    var main = MAIN_CALENDAR ? CalendarApp.getCalendarById(MAIN_CALENDAR) : null;
    var all = CalendarApp.getAllCalendars();
    var find = function (rx) { var c = all.filter(function (x) { return rx.test(x.getName()); })[0]; return c ? c.getId() : null; };
    var own = CalendarApp.getDefaultCalendar();
    ids = {
      primary: (main || own).getId(),
      // This account's own calendar too, when the main one is a different (shared) calendar.
      personal: main && main.getId() !== own.getId() ? own.getId() : null,
      study: find(STUDY_NAME), canvas: find(CANVAS_NAME), classes: find(CLASSES_NAME), sleep: find(SLEEP_NAME)
    };
    cache.put('calendarIds3', JSON.stringify(ids), 6 * 3600);
  }
  var list = [];
  ['primary', 'personal', 'study', 'canvas', 'classes', 'sleep'].forEach(function (key) {
    if (!ids[key]) return;
    var cal = CalendarApp.getCalendarById(ids[key]);
    if (cal) list.push({ key: key, cal: cal });
  });
  return list;
}

function calendarFor_(key) {
  var found = calendars_().filter(function (c) { return c.key === key; })[0];
  return found ? found.cal : null;
}

// Everything the boards need: the schedule for the next FUTURE_DAYS, deadlines for the next
// DEADLINE_DAYS, and `sources`: which calendars loaded, so a board can say when something's missing.
function events_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('events');
  if (hit) {
    var parsed = JSON.parse(hit);
    if (parsed && parsed.events) return parsed;
  }

  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - PAST_DAYS);
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FUTURE_DAYS);
  var far = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DEADLINE_DAYS);
  var out = [], sources = {};

  // Canvas straight from its feed when the URL is set; the subscribed Google calendar otherwise.
  var feed = canvasFeed_(start, far);
  if (feed.ok) { out = out.concat(feed.events); sources.canvas = { ok: true, via: 'feed', n: feed.events.length }; }

  var cals = calendars_();
  if (!cals.some(function (c) { return c.key === 'canvas'; }) && !feed.ok) {
    sources.canvas = { ok: false, via: 'calendar', error: feed.tried ? 'feed: ' + feed.error + '; no Canvas calendar either' : 'no calendar named Canvas' };
  }
  cals.forEach(function (c) {
    if (c.key === 'canvas' && feed.ok) return;
    var list;
    try {
      list = c.cal.getEvents(start, end);
      // Past the schedule window, only what could be a deadline.
      if (c.key !== 'study' && c.key !== 'sleep') {
        list = list.concat(c.cal.getEvents(end, far).filter(function (ev) {
          return ev.getStartTime() >= end && isDeadline({ src: c.key, title: ev.getTitle() || '', allDay: ev.isAllDayEvent(),
            start: ev.getStartTime().getTime(), end: ev.getEndTime().getTime() });
        }));
      }
    } catch (err) {
      // One broken calendar shouldn't blank the board, but the board says so.
      sources[c.key] = { ok: false, error: String(err && err.message || err).slice(0, 120) };
      return;
    }
    var n = 0;
    list.forEach(function (ev) {
      try {
        if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) return;
      } catch (err) { /* status not available on some calendars */ }
      var item = {
        id: ev.getId(),
        cal: c.key,
        title: ev.getTitle() || 'Busy',
        where: ev.getLocation() || '',
        allDay: ev.isAllDayEvent()
      };
      if (item.allDay) {
        item.startDate = Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd');
        item.endDate = Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd');
      } else {
        item.start = ev.getStartTime().getTime();
        item.end = ev.getEndTime().getTime();
      }
      if (c.key !== 'canvas') item.desc = String(ev.getDescription() || '').slice(0, 2000);
      out.push(item); n++;
    });
    if (!sources[c.key]) sources[c.key] = { ok: true, n: n };
    if (c.key === 'canvas') sources.canvas = { ok: true, via: 'calendar', n: n, note: feed.tried ? 'feed failed (' + feed.error + '), using the Google calendar' : '' };
  });

  var result = { events: out, sources: sources };
  try { cache.put('events', JSON.stringify(result), CACHE_SECONDS); } catch (err) { /* too large to cache */ }
  return result;
}

/* ---------- Canvas feed ---------- */

function canvasFeed_(from, to) {
  var url = PropertiesService.getScriptProperties().getProperty('CANVAS_ICS_URL');
  if (!url) return { ok: false, tried: false };
  var cache = CacheService.getScriptCache();
  var text = cache.get('canvasIcs');
  if (!text) {
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (res.getResponseCode() !== 200) return { ok: false, tried: true, error: 'HTTP ' + res.getResponseCode() };
      text = res.getContentText();
      if (text.indexOf('BEGIN:VCALENDAR') < 0) return { ok: false, tried: true, error: 'not a calendar feed' };
      try { cache.put('canvasIcs', text, 15 * 60); } catch (err) { /* over 100 KB: fetch each time */ }
    } catch (err) {
      return { ok: false, tried: true, error: String(err && err.message || err).slice(0, 80) };
    }
  }
  var lo = from.getTime(), hi = to.getTime();
  var events = parseIcs_(text, Session.getScriptTimeZone()).filter(function (e) {
    var s = e.allDay ? localDate(e.startDate) : e.start;
    return s >= lo && s < hi;
  });
  return { ok: true, tried: true, events: events };
}

/** The VEVENTs of an iCalendar file, in the same shape as calendar events. */
function parseIcs_(text, tz) {
  var lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  var list = [], cur = null;
  lines.forEach(function (l) {
    if (l === 'BEGIN:VEVENT') { cur = {}; return; }
    if (l === 'END:VEVENT') { if (cur) list.push(cur); cur = null; return; }
    if (!cur) return;
    var i = l.indexOf(':');
    if (i < 0) return;
    var head = l.slice(0, i), name = head.split(';')[0].toUpperCase();
    cur[name] = { params: head, val: l.slice(i + 1) };
  });
  var unescape = function (v) { return String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim(); };
  var out = [];
  list.forEach(function (v) {
    if (!v.DTSTART || !v.SUMMARY) return;
    var s = icsTime_(v.DTSTART, tz), e = v.DTEND ? icsTime_(v.DTEND, tz) : null;
    if (!s) return;
    var item = { id: (v.UID ? unescape(v.UID.val) : unescape(v.SUMMARY.val)), cal: 'canvas', title: unescape(v.SUMMARY.val), where: v.LOCATION ? unescape(v.LOCATION.val) : '' };
    if (s.date) {
      item.allDay = true; item.startDate = s.date;
      item.endDate = e && e.date ? e.date : Utilities.formatDate(new Date(localDate(s.date) + 36 * 3600000), tz, 'yyyy-MM-dd');
    } else {
      item.allDay = false; item.start = s.ms; item.end = e && e.ms ? e.ms : s.ms;
    }
    out.push(item);
  });
  return out;
}

function icsTime_(p, tz) {
  var v = String(p.val).trim();
  if (/VALUE=DATE(;|$)/i.test(p.params) || /^\d{8}$/.test(v)) return { date: v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8) };
  var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(v);
  if (!m) return null;
  if (m[7]) return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) };
  var zone = (/TZID=([^;:]+)/i.exec(p.params) || [])[1] || tz;
  return { ms: Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00'), zone, 'yyyy-MM-dd HH:mm:ss').getTime() };
}

/* ---------- Evening email: tomorrow's deadlines ---------- */

// Runs every evening (setup() installs it). Sends one short email only when something is due
// tomorrow, an exam or quiz is 3 days out, or Canvas didn't load. A backstop that works even if
// no screen is on and the widget hasn't refreshed.
function dailyDigest() {
  CacheService.getScriptCache().remove('events');
  var data = events_(), s = state_(), now = new Date();
  var evs = data.events.map(function (e) {
    return e.allDay
      ? { src: e.cal, title: e.title, allDay: true, start: localDate(e.startDate), end: e.endDate ? localDate(e.endDate) : localDate(e.startDate) + DAY }
      : { src: e.cal, title: e.title, allDay: false, start: e.start, end: e.end };
  });
  var list = buildDeadlines(evs, now).filter(function (d) { return !s.doneDue[dueKey(d)] && dueEndOf(d) > now.getTime(); });
  var tmr = dayKey(addDays(now, 1, 12)), in3 = dayKey(addDays(now, 3, 12));
  var line = function (d) { return '• ' + (d.raw || d.title) + (d.dueAt ? ' at ' + fmtTime(d.dueAt) : ' (no time given: check when it is due)'); };
  var parts = [];
  var due = list.filter(function (d) { return d.day === tmr; });
  if (due.length) parts.push('Due tomorrow:\n' + due.map(line).join('\n'));
  var exams = list.filter(function (d) { return d.day === in3 && isExam(d); });
  if (exams.length) parts.push('In 3 days:\n' + exams.map(line).join('\n'));
  var bad = Object.keys(data.sources).filter(function (k) { return data.sources[k] && data.sources[k].ok === false; });
  if (bad.length) parts.push('Not loaded, so the list above may be missing things: ' + bad.join(', ') + '. Check Canvas directly.');
  if (!parts.length) return;
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
    (due.length ? 'Due tomorrow: ' + due.map(function (d) { return d.title; }).join(', ') : bad.length ? 'Desk Board: a calendar did not load' : 'Coming up in 3 days').slice(0, 120),
    parts.join('\n\n'));
}

/** Finds one occurrence by its id and start time (recurring blocks share an id). */
function findEvent_(block) {
  if (!block || !block.id || !block.start) return null;
  var cal = calendarFor_(block.cal);
  if (!cal) return null;
  var t = Number(block.start);
  var matches = cal.getEvents(new Date(t), new Date(t + 60000)).filter(function (ev) {
    return ev.getId() === block.id && ev.getStartTime().getTime() === t;
  });
  return matches[0] || null;
}

/** Replaces "Label: value" in an event description, or appends it. */
function setLine_(desc, label, value) {
  var re = new RegExp('^\\s*' + label + ':.*$', 'im');
  var line = label + ': ' + value;
  if (re.test(desc)) return desc.replace(re, line);
  return desc ? desc.replace(/\s+$/, '') + '\n' + line : line;
}

/* ---------- Check-ins ---------- */

var CHECKIN = {
  done: { label: 'Done', color: CalendarApp.EventColor.GREEN },
  partly: { label: 'Partly', color: CalendarApp.EventColor.YELLOW },
  missed: { label: 'Missed', color: CalendarApp.EventColor.RED }
};

function checkin_(body) {
  var choice = CHECKIN[body.r];
  if (!choice) return { ok: false, error: 'bad rating' };
  var ev = findEvent_(body.block);
  if (!ev) return { ok: false, error: 'block not found' };
  ev.setDescription(setLine_(String(ev.getDescription() || ''), 'Check-in', choice.label));
  ev.setColor(choice.color);
  CacheService.getScriptCache().remove('events');
  return { ok: true };
}

/* ---------- Step checkboxes ---------- */

// Steps are description lines like "- [ ] Write addAfter". Ticking one on the
// board turns it into "- [x] Write addAfter" (a plain "- " step gets a box added).
function step_(body) {
  var ev = findEvent_(body.block);
  if (!ev) return { ok: false, error: 'block not found' };
  var text = String(body.text || '').trim();
  if (!text) return { ok: false, error: 'no step' };
  var desc = String(ev.getDescription() || '');
  var idx = findStep_(desc, text);
  if (idx < 0) idx = findStep_(desc, text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  if (idx < 0) return { ok: false, error: 'step not found' };
  var before = desc.slice(0, idx), after = desc.slice(idx);
  var box = /\[[ xX]?\]\s*$/.exec(before);
  var mark = body.done ? '[x] ' : '[ ] ';
  before = box ? before.slice(0, box.index) + mark : before + mark;
  ev.setDescription(before + after);
  CacheService.getScriptCache().remove('events');
  return { ok: true };
}

/** Position of a step's text when it fills a whole line (after any bullet and box), or -1. */
function findStep_(desc, text) {
  var from = 0, i;
  while ((i = desc.indexOf(text, from)) >= 0) {
    var lead = /(^|\n|>)\s*(?:[-•*·]|\d+[.)])?\s*(?:\[[ xX]?\]\s*)?$/.test(desc.slice(0, i));
    var tail = /^\s*(\n|<|$)/.test(desc.slice(i + text.length));
    if (lead && tail) return i;
    from = i + 1;
  }
  return -1;
}

/* ---------- Missed and partly done blocks get a new slot ---------- */

// Copies what's left of a block into the next free slot: at least 15 minutes from now,
// clear of every calendar, and outside the protected sleep window.
function reschedule_(body) {
  var ev = findEvent_(body.block);
  if (!ev) return { ok: false, error: 'block not found' };
  return moveBlock_(ev, body.r, null);
}

function moveBlock_(ev, r, busy) {
  var study = calendarFor_('study');
  if (!study) return { ok: false, error: 'no study calendar' };
  var desc = String(ev.getDescription() || '');
  var lines = desc.replace(/<br\s*\/?>/gi, '\n').split('\n');
  var stepRx = /^\s*(?:[-•*·]|\d+[.)])\s+/;
  var steps = lines.filter(function (l) { return stepRx.test(l); });
  var open = steps.filter(function (l) { return !/\[[xX]\]/.test(l); });

  var dur = ev.getEndTime().getTime() - ev.getStartTime().getTime();
  if (r === 'partly') dur = steps.length ? dur * Math.max(open.length, 1) / steps.length : dur / 2;
  dur = Math.max(30, Math.round(dur / 60000 / 15) * 15) * 60000;

  var slot = freeSlot_(dur, null, busy);
  if (!slot) return { ok: false, error: 'no free slot this week' };

  var tz = Session.getScriptTimeZone();
  var when = function (d) { return Utilities.formatDate(d, tz, 'EEE HH:mm'); };
  var keep = lines.filter(function (l) {
    if (/^\s*(Check-in|Pomodoros|Moved (from|to)):/i.test(l)) return false;
    return !stepRx.test(l) || !/\[[xX]\]/.test(l);
  });
  var newDesc = keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  newDesc = setLine_(newDesc, 'Moved from', when(ev.getStartTime()) + ' (' + (r === 'partly' ? 'partly done' : 'missed') + ')');
  study.createEvent(ev.getTitle(), slot.start, slot.end, { description: newDesc, location: ev.getLocation() || '' });
  ev.setDescription(setLine_(desc, 'Moved to', when(slot.start)));
  CacheService.getScriptCache().remove('events');
  return { ok: true, start: slot.start.getTime(), end: slot.end.getTime() };
}

/* ---------- Night check-in and fresh starts ---------- */

/** Blocks worth a check-in: real Study work of 30+ minutes that has ended. */
function checkable_(from, to) {
  var study = calendarFor_('study');
  if (!study) return [];
  return study.getEvents(new Date(from), new Date(to)).filter(function (ev) {
    var s = ev.getStartTime().getTime(), e = ev.getEndTime().getTime();
    return !ev.isAllDayEvent() && e <= Date.now() && e - s >= 30 * 60000 && !SKIP_CHECK.test(ev.getTitle());
  });
}

// "Looks right" on the night check-in: every block of that day you didn't rate is logged as Done.
function reviewed_(body) {
  var day = String(body.day || '');
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return { ok: false, error: 'bad day' };
  var from = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  checkable_(from, from + 86400000 + 4 * 3600000).forEach(function (ev) {
    var desc = String(ev.getDescription() || '');
    if (/^\s*Check-in:/im.test(desc) || ev.getStartTime().getTime() >= from + 86400000) return;
    ev.setDescription(setLine_(desc, 'Check-in', 'Done'));
    ev.setColor(CHECKIN.done.color);
  });
  CacheService.getScriptCache().remove('events');
  var s = state_();
  s.reviewed = day;
  saveState_(s);
  return { ok: true, state: s };
}

// A fresh start: blocks from the last few days that were Missed or Partly (and not moved yet)
// go into free slots this week, oldest first. With keep:false nothing moves; the slate is just cleared.
function reset_(body) {
  var days = Math.max(1, Math.min(7, Number(body.days) || 7));
  var s = state_();
  s.resetAt = Date.now();
  var moved = [], failed = 0;
  if (body.keep !== false) {
    var busy = busy_(Date.now() + 7 * 86400000);
    checkable_(Date.now() - days * 86400000, Date.now()).filter(function (ev) {
      var desc = String(ev.getDescription() || '');
      return /^\s*Check-in:\s*(Missed|Partly)/im.test(desc) && !/^\s*Moved to:/im.test(desc);
    }).slice(0, 8).forEach(function (ev) {
      var r = /^\s*Check-in:\s*Partly/im.test(String(ev.getDescription() || '')) ? 'partly' : 'missed';
      var res = moveBlock_(ev, r, busy);
      if (res.ok) moved.push({ title: ev.getTitle(), start: res.start }); else failed++;
    });
  }
  saveState_(s);
  return { ok: true, moved: moved, failed: failed, state: s };
}

// Busy times from every calendar (except Canvas) between now and `until`, plus each day's Study minutes.
function busy_(until) {
  var now = Date.now(), busy = [], study = {};
  var tz = Session.getScriptTimeZone();
  calendars_().forEach(function (c) {
    if (c.key === 'canvas') return;
    var list;
    try { list = c.cal.getEvents(new Date(now - 86400000), new Date(until)); } catch (err) { return; }
    list.forEach(function (ev) {
      if (ev.isAllDayEvent()) return;
      try { if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; } catch (err) {}
      var s = ev.getStartTime().getTime(), e = ev.getEndTime().getTime();
      // A long same-day event on another calendar (like "Early Voting 9–5") is context, not busy time.
      if (c.key !== 'study' && c.key !== 'sleep' && e - s >= 6 * 3600000 && e - s < 20 * 3600000) return;
      busy.push([s - 10 * 60000, e + 10 * 60000]);
      if (c.key === 'study') {
        var d = Utilities.formatDate(new Date(s), tz, 'yyyy-MM-dd');
        study[d] = (study[d] || 0) + (e - s);
      }
    });
  });
  return { list: busy, study: study };
}

// Plans to about 70%: a new block goes in the first free slot that keeps the day under
// STUDY_CAP_HOURS of Study time and still leaves SLACK_MINUTES of free, awake time,
// so one missed block has somewhere to go without pushing everything else back.
function freeSlot_(dur, before, busy) {
  var now = Date.now(), until = Math.min(now + 7 * 86400000, before || Infinity);
  busy = busy || busy_(until);
  var tz = Session.getScriptTimeZone();
  var step = 15 * 60000;
  var t = Math.ceil((now + 15 * 60000) / step) * step;
  var dayOk = {};
  while (t + dur <= until) {
    var d = new Date(t);
    var wake = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WAKE_HOUR).getTime();
    var bed = new Date(d.getFullYear(), d.getMonth(), d.getDate(), BED_HOUR).getTime();
    var nextDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, WAKE_HOUR).getTime();
    if (t < wake) { t = wake; continue; }
    if (t + dur > bed) { t = nextDay; continue; }
    var key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    if (!(key in dayOk)) dayOk[key] = roomInDay_(busy, key, Math.max(wake, now), bed);
    if ((busy.study[key] || 0) + dur > STUDY_CAP_HOURS * 3600000 || dayOk[key] - dur < SLACK_MINUTES * 60000) { t = nextDay; continue; }
    var clash = busy.list.filter(function (b) { return b[0] < t + dur && b[1] > t; })[0];
    if (!clash) {
      busy.list.push([t - 10 * 60000, t + dur + 10 * 60000]);
      busy.study[key] = (busy.study[key] || 0) + dur;
      delete dayOk[key];
      return { start: new Date(t), end: new Date(t + dur) };
    }
    t = Math.ceil(clash[1] / step) * step;
  }
  return null;
}

/** Free, awake milliseconds left in a day (busy times merged so overlaps count once). */
function roomInDay_(busy, key, from, to) {
  var parts = busy.list.map(function (b) { return [Math.max(b[0], from), Math.min(b[1], to)]; })
    .filter(function (b) { return b[1] > b[0]; }).sort(function (a, b) { return a[0] - b[0]; });
  var used = 0, end = from;
  parts.forEach(function (b) {
    if (b[1] <= end) return;
    used += b[1] - Math.max(b[0], end);
    end = b[1];
  });
  return Math.max(0, to - from - used);
}

/* ---------- Desktop board: done deadlines, layout, finding time ---------- */

function dueDone_(body) {
  var key = String(body.due || '').slice(0, 60);   // not body.key: that's the board key
  if (!/^\d{4}-\d{2}-\d{2}\|/.test(key)) return { ok: false, error: 'bad key' };
  var s = state_();
  if (body.done) s.doneDue[key] = Date.now(); else delete s.doneDue[key];
  saveState_(s);
  return { ok: true, state: s };
}

function layout_(body) {
  var input = body.layout && typeof body.layout === 'object' ? body.layout : {};
  var clean = {};
  Object.keys(input).slice(0, 60).forEach(function (k) {
    var v = input[k] || {};
    if (!/^\d{4}-\d{2}-\d{2}\|/.test(k) || ['now', 'next', 'later'].indexOf(v.lane) < 0) return;
    clean[k.slice(0, 60)] = { lane: v.lane, pos: Number(v.pos) || 0 };
  });
  var s = state_();
  s.layout = clean;
  saveState_(s);
  return { ok: true, state: s };
}

// "Find 1h" on a deadline: puts a work block in the first free slot before it's due.
function plan_(body) {
  var study = calendarFor_('study');
  if (!study) return { ok: false, error: 'no study calendar' };
  var mins = Math.max(30, Math.min(240, Number(body.minutes) || 60));
  var before = Number(body.before) || null;
  var slot = freeSlot_(mins * 60000, before);
  if (!slot) return { ok: false, error: 'no free slot before it is due' };
  var title = String(body.title || 'Work block').slice(0, 80);
  study.createEvent(title, slot.start, slot.end, { location: String(body.where || 'Library').slice(0, 60) });
  CacheService.getScriptCache().remove('events');
  return { ok: true, start: slot.start.getTime(), end: slot.end.getTime() };
}

/* ---------- How long things take ---------- */

// Groups past Study blocks by course and kind of work ("AP lab", "Lit Hum reading")
// and compares what got done with what was planned. finish 0.6 means about 60% of
// planned blocks got done, so similar blocks need about 1.7× the time.
var KIND_WORDS = { essay: 'essay', paper: 'essay', draft: 'essay', revise: 'essay', report: 'report', lab: 'lab',
  pset: 'psets', psets: 'psets', problem: 'psets', exercise: 'exercise', reading: 'reading', rdg: 'reading',
  wr: 'reading', quiz: 'review', exam: 'review', midterm: 'review', review: 'review', prep: 'review',
  flashcards: 'flashcards', vocab: 'flashcards', slides: 'slides' };
var COURSE_WORDS = { ap: 'AP', uw: 'UW', lit: 'Lit Hum', econ: 'Econ', chinese: 'Chinese', chn: 'Chinese',
  phys: 'Phys', physics: 'Phys', cs: 'CS', chem: 'Chem', chemistry: 'Chem', computing: 'Computing', python: 'Computing',
  discrete: 'Discrete', linear: 'Lin Alg', probability: 'Probability', theory: 'Theory', databases: 'Databases',
  graphics: 'Graphics', nlp: 'NLP', ai: 'AI', ase: 'ASE', psych: 'Psych', psychology: 'Psych', astro: 'Astro' };

function groupOf_(title) {
  var words = String(title).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter(Boolean);
  var course = null, kind = null;
  words.forEach(function (w) {
    if (!course && COURSE_WORDS[w]) course = COURSE_WORDS[w];
    if (!kind && KIND_WORDS[w]) kind = KIND_WORDS[w];
  });
  if (/weekly review/i.test(title)) return null;
  if (!course && !kind) return null;
  return (course ? course + ' ' : '') + (kind || 'work');
}

function stats_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('stats');
  if (hit) return JSON.parse(hit);
  var study = calendarFor_('study');
  if (!study) return [];
  var now = new Date(), from = new Date(now.getTime() - STATS_DAYS * 86400000);
  var groups = {}, st = state_(), tz = Session.getScriptTimeZone();
  study.getEvents(from, now).forEach(function (ev) {
    if (ev.isAllDayEvent() || ev.getEndTime() > now) return;
    var mins = (ev.getEndTime() - ev.getStartTime()) / 60000;
    if (mins < 30) return;
    var m = /^\s*Check-in:\s*(Done|Partly|Missed)/im.exec(String(ev.getDescription() || ''));
    var rating = m ? m[1].toLowerCase() : null;
    // No rating on a day you used the board: nothing went wrong, so it counts as done.
    if (!rating && st.active[Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd')] && !SKIP_CHECK.test(ev.getTitle())) rating = 'done';
    if (!rating) return;
    var g = groupOf_(ev.getTitle());
    if (!g) return;
    var x = groups[g] || (groups[g] = { label: g, n: 0, done: 0, partly: 0, missed: 0, minutes: 0 });
    x.n++; x.minutes += mins; x[rating]++;
  });
  var out = Object.keys(groups).map(function (k) {
    var x = groups[k];
    x.finish = (x.done + 0.5 * x.partly) / x.n;
    x.factor = x.n >= 3 ? Math.round(Math.min(2.5, Math.max(1, 1 / Math.max(x.finish, 0.4))) * 10) / 10 : null;
    return x;
  }).sort(function (a, b) { return b.n - a.n; });
  cache.put('stats', JSON.stringify(out), 3600);
  return out;
}

// Once a day, the next Weekly review block gets the numbers, so planning (yours or anyone's) can use them.
function writeEstimates_(stats) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (props.getProperty('ESTIMATES_DAY') === today) return;
  props.setProperty('ESTIMATES_DAY', today);
  var study = calendarFor_('study');
  if (!study) return;
  var lines = stats.filter(function (x) { return x.factor; }).map(function (x) {
    return 'Estimate: ' + x.label + ' ×' + x.factor + ' (' + x.n + ' rated, ' + Math.round(x.finish * 100) + '% done)';
  });
  if (!lines.length) return;
  var now = new Date();
  study.getEvents(now, new Date(now.getTime() + 8 * 86400000)).filter(function (ev) {
    return /weekly review/i.test(ev.getTitle());
  }).slice(0, 1).forEach(function (ev) {
    var desc = String(ev.getDescription() || '').replace(/^\s*Estimate:.*$\n?/gim, '').replace(/\s+$/, '');
    ev.setDescription((desc ? desc + '\n' : '') + lines.join('\n'));
  });
}

/* ---------- Focus timer ---------- */

var FOCUS_MS = 25 * 60000;

function cleanTimer_(t) {
  t = t || {};
  return {
    phase: t.phase === 'rest' ? 'rest' : 'focus',
    endAt: typeof t.endAt === 'number' ? t.endAt : null,
    left: typeof t.left === 'number' ? Math.max(0, Math.min(t.left, FOCUS_MS)) : FOCUS_MS
  };
}

function state_() {
  var raw = PropertiesService.getScriptProperties().getProperty('STATE');
  var s = raw ? JSON.parse(raw) : {};
  var obj = function (x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; };
  return {
    timer: cleanTimer_(s.timer),
    log: obj(s.log),
    lastDoneEnd: typeof s.lastDoneEnd === 'number' ? s.lastDoneEnd : null,
    doneDue: obj(s.doneDue),     // deadlines you've marked finished: key -> when
    layout: obj(s.layout),       // desktop board: key -> { lane, pos }
    active: obj(s.active),       // days with any tap on a board: "2026-11-13" -> 1
    lastActive: typeof s.lastActive === 'number' ? s.lastActive : null,
    reviewed: typeof s.reviewed === 'string' ? s.reviewed : null,   // last day the night check-in was closed
    resetAt: typeof s.resetAt === 'number' ? s.resetAt : null       // last fresh start
  };
}

function saveState_(s) {
  var tz = Session.getScriptTimeZone();
  var cutoff = Utilities.formatDate(new Date(Date.now() - 45 * 86400000), tz, 'yyyy-MM-dd');
  [s.log, s.active].forEach(function (m) { Object.keys(m || {}).forEach(function (k) { if (k < cutoff) delete m[k]; }); });
  // Deadline keys start with their due date ("2026-11-05|…"), so old ones can be dropped.
  [s.doneDue, s.layout].forEach(function (m) { Object.keys(m || {}).forEach(function (k) { if (k.slice(0, 10) < cutoff) delete m[k]; }); });
  PropertiesService.getScriptProperties().setProperty('STATE', JSON.stringify(s));
}

function pomoDone_(body) {
  var s = state_();
  var ended = Number(body.ended);
  if (!ended || s.lastDoneEnd === ended) return { ok: true, state: s, duplicate: true };
  s.lastDoneEnd = ended;
  if (body.timer) s.timer = cleanTimer_(body.timer);

  if (body.focus) {
    var day = Utilities.formatDate(new Date(ended), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    s.log[day] = (Number(s.log[day]) || 0) + 1;
    var ev = body.block ? findEvent_(body.block) : null;
    if (ev) {
      var desc = String(ev.getDescription() || '');
      var m = /^\s*Pomodoros:\s*(\d+)/im.exec(desc);
      ev.setDescription(setLine_(desc, 'Pomodoros', (m ? Number(m[1]) : 0) + 1));
      CacheService.getScriptCache().remove('events');
    }
  }
  saveState_(s);
  return { ok: true, state: s };
}

/* ---------- Helpers ---------- */

function authorized_(key) {
  var want = PropertiesService.getScriptProperties().getProperty('BOARD_KEY');
  return !!want && key === want;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
