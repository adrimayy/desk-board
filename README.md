# Desk Board

A full-screen desk display for a spare iPhone: clock, the calendar block you're in and its first step, a focus timer, what's due, and one check-in a night.

```
apps-script/Code.gs   the script that reads your calendars (runs on a personal Gmail account)
apps-script/Rules.gs  the deadline rules for the script (generated from rules.js)
index.html, desk.html the site (GitHub Pages serves this folder): one address, index.html on phones and
                      desk.html on bigger screens, plus rules.js (deadline rules shared by everything), shorten.js and icons
widget/               the Scriptable widget for iPhone and Mac
```

Your calendars stay on your school account and are shared with the personal account, which runs the script.

## 1. Share and subscribe (once)

- **School calendar:** share your main calendar and your Study Calendar with your personal Gmail, using "Make changes to events." Accept the emails on the personal account.
- **Personal Google Calendar:** go to **+ Other calendars → From URL** and paste your Canvas calendar feed link (Canvas → Calendar → **Calendar Feed**). Rename the new calendar so its name includes **Canvas**.
- At the top of `Code.gs`, `MAIN_CALENDAR` is set to your school calendar's address.

## 2. Script (personal account)

1. Go to **script.google.com → New project** and paste in `Code.gs`. Add a second file (**+ → Script**) named `Rules` and paste in `Rules.gs`.
2. Optional but recommended: **Project Settings → Script properties → Add** `CANVAS_ICS_URL` with your Canvas feed link (see "Deadlines you can rely on").
3. Choose **setup** → **Run** → approve (it asks for calendar, email and outside-link access). Copy **Your board key** from the Execution log. Setup also turns on the 20:00 deadline email and logs which calendars it found.
4. Go to **Deploy → New deployment → Web app**. Set Execute as **Me** and access to **Anyone**, then Deploy. Copy the URL.
5. Test it: `URL?action=ping&key=KEY` should show `{"ok":true…}`.

## 3. Page

Upload the files in the site files to your GitHub Pages repo, replacing the old ones. Open the page, paste the URL and key, press **Connect**, then press **Copy phone link**.

## 4. iPhone

Delete the old Home Screen icon. Open the phone link in Safari, then **Share → Add to Home Screen**, and open it from the icon. Turn on Guided Access with Display Auto-Lock set to Never, then triple-click the side button and press **Start**.

Hold the date for one second to reopen setup. Press the **i** key for a guide to everything on the screen, with the board's current status at the top.

## Using it

- **Places:** put where a block happens in the event's location ("Library", "Dorm desk"). The board shows it and the widget's notifications use it.
- **Planning:** put blocks on your Study Calendar. Steps are optional: write them in the description as lines starting with `- ` or `- [ ] `, or leave them out and the board shows "Open it and do one 25-min round".
- **Plan to about 70%:** size blocks at about 1.5× your first guess (or the `Estimate:` multipliers), keep a day under 6 hours of Study blocks, and leave at least 90 free minutes a day. Rescheduling, the fresh starts and Find 1h / 2h follow the same rule (`STUDY_CAP_HOURS` and `SLACK_MINUTES` in `Code.gs`).
- **Learning modes (PACER):** add a line like `Mode: C + E` to a block's description. P = procedural (practice it now), A = analogous (critique the analogy), C = conceptual (map it), E = evidence (store it, rehearse later), R = reference (flashcards). The board shows the modes on the block, and breaks during that block say what to digest first.
- **Digest steps:** a step that starts with `Digest:` shows a diamond instead of a square, so consuming and digesting stay visibly balanced.
- **Steps:** tap a step on the board to tick it off; it's saved on the calendar as `- [x] `. Tap the "steps done" row to untick the last one. You can also type `[x]` yourself in Google Calendar.
- **Due:** see "Deadlines you can rely on" below. The right column is time already blocked on your Study Calendar before it's due. Only the most urgent deadline with nothing blocked gets a red `0h`. Finished early? Tap the row, then tap it again: it's marked done on every board, with an Undo for a few seconds.
- **Timer:** Start runs a 25-minute focus round; the 5-minute break then starts on its own. During a learning block the break first says what to digest.
- **Offline:** the board keeps the last calendar copy, so a relaunch without Wi-Fi still shows your day (marked Offline with the last sync time).
- **Night check-in:** once a day, after 21:00 and your last block, the strip asks about the day. **All done** logs every block as Done. **Not all** goes through them one at a time, then offers to move what's left. If you never answer, the blocks count as done. There's no question after each block.
- **Rescheduling:** what's left of a block (unticked steps, or the full length if missed) is copied to the first free slot at least 15 minutes away that's clear on every calendar, outside sleep (your Sleep calendar, plus `WAKE_HOUR`/`BED_HOUR` in `Code.gs`: 1–9 AM) and within the 70% rule.
- **Fresh starts:** Sunday evening and Monday the strip offers to move last week's unfinished blocks into the new week, or let them go. After four days without a tap on any board it asks if you want a fresh start (or tap "I'm on track").
- **Quiet mode:** when nothing needs you (no block on or within 45 minutes, nothing due today, no question, no timer), the board dims everything except the clock and the next block.
- **Estimates:** night check-ins from the last three weeks (unmarked blocks on a day you used the board count as done) are grouped by course and kind of work ("AP lab", "Lit Hum reading"). With 3+ rated blocks the board's info guide shows a multiplier like ×1.6, and the next Weekly review block gets an `Estimate:` line for each, so new blocks can be sized to how long things actually take.
- **Long titles:** `shorten.js` abbreviates them to fit. Add your own abbreviations to `WORDS` near the top of that file.

## Widget (iPhone, and Mac desktop)

`widget/Desk Board.js` is a script for **Scriptable**, a free iPhone app. It shows the block you're in or the next one, its first step, and what's due. Tapping it opens the board.

1. Install **Scriptable** from the App Store.
2. Put `Desk Board.js` in the Scriptable folder in iCloud Drive, or create a new script in the app and paste the file's contents in.
3. Run it once in Scriptable. Paste the phone link from the board's setup sheet (**Copy phone link**) and press **Save**.
4. Add the widget: long-press the Home Screen → **+** → **Scriptable** → pick a size → **Add Widget**. Long-press it → **Edit Widget** → **Script: Desk Board**.
   - The Lock Screen widgets work too (rectangular, inline and circular).
5. **Mac:** on macOS Sonoma or later, signed in to the same Apple ID, right-click the desktop → **Edit Widgets** and pick the Scriptable widget from the iPhone section. (System Settings → Desktop & Dock → **Use iPhone widgets** must be on.)

Widgets update about every 15 minutes, and also right when a block starts or ends.

**Notifications:** kept few on purpose, since reminders stop working when there are many. "Head to Library" 10 minutes before a block only when you have to move, and "Start: …" only for the first block of the day. Nothing fires while a focus round is running. Allow notifications for Scriptable when asked. Turn them off from the script's menu in Scriptable.

**Pixel font (optional):** the widget uses the system font until you install the fonts in `widget/fonts/`.
- iPhone: install both `.ttf` files with a font installer app (such as iFont), then run the script in Scriptable and choose **Use Jersey 10**.
- Mac: double-click each `.ttf` → **Install Font**, so the widget looks the same on the desktop.

Changing `shorten.js` or `widget.src.js`: run `widget/build.sh` to rebuild `Desk Board.js`.

## One site, two layouts

There's one address (`…/desk-board/`). Phones get the desk-display board (`index.html`); laptops, desktops and iPads get the desktop board (`desk.html`). Both read the same calendar script, the same rules (`rules.js`) and the same saved state, so done, starred and checked-in are the same everywhere, and both sign in from the same link. The desktop board also rearranges itself for narrow windows.

To pin a layout on one device, add `?view=board` or `?view=desk` to the address (`?view=auto` goes back to choosing by screen size). That's how you'd put the LCD board on an iPad, say.

## Desktop board (`desk.html`)

It's laid out like Google Tasks with a Google Classroom side: a sidebar on the left, the to-do list in the middle, and what's happening now down the right.

- **To do:** everything due in the next six weeks as a task list, grouped into Starred, Today, Tomorrow, This week, Later and Completed. Later and Completed start folded (Later's header still names what's next). Something whose due time passed today stays in Today, marked "Passed", until you tick it or the day ends. Each row shows the class, how much time is planned and when the next block is. Only the most urgent deadline with no time planned is flagged. Click a row (or press Enter) to open it: due date and countdown, Find 1h / 2h, the next block's steps as checkboxes, and the blocks after that.
- **Mark done:** the circle on a row, the D key, or dragging it to Completed. Finished assignments also disappear from the phone board and widget.
- **Star and reorder:** the star on a row (or S) pins it to Starred at the top. Drag rows to reorder them inside a group. Dates can't be changed by dragging. The order and stars are saved to the calendar script, so they're the same on every computer.
- **Find 1h / 2h:** adds a Study block in the first free slot before it's due.
- **Classes:** a card per class this semester with its next class, what's due soon and the next work block. Clicking a class (or picking it in the sidebar) filters the to-do list to just that class.
- **Courses follow your calendar:** the board has the names, colors and title patterns for every course in the four-year plan built in, but only shows the ones on the Classes calendar right now, so it switches over by itself each semester.
- **Right side:** the night check-in (each block with Done / Partly / Missed, then **Looks right**), the fresh-start offers, the block you're in or the next one with its steps and a focus button, and today's schedule.
- **Keys:** ↑ ↓ (or J K) move between tasks, Enter opens, D done, S star.

## Deadlines you can rely on

The deadline rules live in one file, `rules.js`, used by the phone board, the desktop board, the widget and the calendar script, so every screen agrees.

- **What counts:** everything in Canvas; calendar events with "due", "deadline" or "submit" in the title (any length, "Study guide due" included); exams and quizzes, but not "review" or "prep" sessions; and all-day events like "Pset 6" or "Essay 3". Study blocks never count. It errs toward showing too much.
- **When it's due:** the start of a timed event (the earliest it could mean), or a time written in an all-day title ("due 6 PM", "due at 11:59pm", "due 18:00"). An all-day deadline with no time is shown on its day from midnight.
- **Duplicates:** the same title on the same day (one event on two synced calendars) shows once. A Canvas item and your own entry merge only when they share the assignment number and kind of work, and then the earlier date wins. Two different assignments are never merged, even for the same class on the same day.
- **How far ahead:** six weeks for deadlines (`DEADLINE_DAYS`), two weeks for the schedule.
- **Never hidden for space:** anything due within 36 hours and the next exam or quiz in 10 days always get a row on the phone and the widget. The rest say "+3 more · next Thu …". The desktop lists everything.
- **Passed today:** stays on screen, faded, until the day ends, in case it wasn't handed in.
- **When something might be missing:** if any calendar fails to load, or a screen hasn't synced for 3 hours, the phone, desktop and widget all say so in red.
- **Canvas directly (recommended):** Google refreshes a subscribed Canvas calendar only every several hours. In Canvas, open Calendar → **Calendar Feed** and copy the link. In Apps Script, open Project Settings → Script properties → add `CANVAS_ICS_URL` with that link. The script then reads Canvas itself (cached 15 minutes) and falls back to the Google calendar if Canvas can't be reached.
- **Reminders that don't need a screen:** every evening at 20:00 the script emails you what's due tomorrow and any exam or quiz three days out, and says if a calendar didn't load. It only sends when there's something to say. The widget also reminds you the evening before (20:00), the morning of (09:15, for what's still ahead), and three days before exams. Turning off block notifications in Scriptable leaves these on.

Limits: a deadline that's only in an email or a syllabus, and nowhere in Canvas or your calendars, can't be seen. Put it on your calendar with "due" in the title.

## Building

`desk.html` and `index.html` are edited directly. After changing `rules.js`, `shorten.js` or `widget/widget.src.js`, run `sh build.sh` to rebuild `widget/Desk Board.js` and `apps-script/Rules.gs`.

## Keeping it light

The board is built to ask for as little as possible, because planning tools usually get dropped when upkeep piles up:

- About two taps a day: the night check-in (zero on a good day) and the occasional star or "done".
- One warning at a time. Passed deadlines fade out at the end of their day instead of piling up in red.
- Few notifications, and none during a focus round.
- Misses go into slack time or Sunday's fresh start instead of a growing backlog.
- When you're away for a few days it offers a clean slate, not a list of what you missed.

