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
- **Which blocks count toward a deadline:** a block counts as time planned for a deadline only when it's clearly the same assignment: same course, plus a shared assignment number ("Essay 3", "L5"), a shared specific word ("Aeneid", "character"), or the same kind of work. Anki and flashcard blocks never count toward assignments (they're their own routine), and a block for one part of a lesson doesn't count toward a different part ("character sheet" vs "exercises").
- **Planning:** put blocks on your Study Calendar. Steps are optional: write them in the description as lines starting with `- ` or `- [ ] `, or leave them out and the board shows "Open it and do one 25-min round".
- **Plan to about 70%:** size blocks at about 1.5× your first guess (or the `Estimate:` multipliers), keep a day under 6 hours of Study blocks, and leave at least 90 free minutes a day. Rescheduling, the fresh starts and Find 1h / 2h follow the same rule (`STUDY_CAP_HOURS` and `SLACK_MINUTES` in `Code.gs`).
- **Learning modes (PACER):** add a line like `Mode: C + E` to a block's description. P = procedural (practice it now), A = analogous (critique the analogy), C = conceptual (map it), E = evidence (store it, rehearse later), R = reference (flashcards). The board shows the modes on the block, and breaks during that block say what to digest first.
- **Digest steps:** a step that starts with `Digest:` shows a diamond instead of a square, so consuming and digesting stay visibly balanced.
- **Steps:** tap a step on the board to tick it off; it's saved on the calendar as `- [x] `. Tap the "steps done" row to untick the last one. You can also type `[x]` yourself in Google Calendar.
- **Due:** see "Deadlines you can rely on" below. The right column is time already blocked on your Study Calendar before it's due. Only the most urgent deadline with nothing blocked gets a red `0h`. Finished early? Tap the row, then tap it again: it's marked done on every board, with an Undo for a few seconds.
- **Timer:** counts up by default. Start when you begin anything (15 minutes of Anki counts as much as a two-hour essay), Pause if you step away, and **Done** logs the minutes to the day and to the Study block you started it in (as a `Worked: 1h 05m` line). It pauses itself 30 minutes after the block ends (or after 2 hours without a block) so a forgotten timer doesn't inflate anything. The tally shows minutes worked today and this week. If you like rounds, switch to **25-minute rounds** (in full screen, or the switch next to the timer on a computer); each finished round logs 25 minutes. During a learning block the break first says what to digest.
- **Free time:** between blocks (no block on, the next one 30+ minutes away, 09:00–23:00) both boards show "Free until 13:00" with the most urgent thing to start: starred first, then whatever is due soonest in the next two weeks. Start puts the timer on it, and Done logs the minutes to that deadline as well as to the day.
- **Estimates** in the weekly review also say how long similar blocks actually took when the timer tracked them.
- **Full-screen timer:** tap the timer (phone) or click it or press **F** (computer) to fill the screen with the countdown, the block and its next step. Tap the big time, press **Esc** or **F**, or use **Exit** to come back. On a computer it also goes browser full screen.
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
- **Top of the list:** what to do now, with the button that starts it: the block you're in (or the next one, with **Start early**), the deadline the timer is on, or in free time the most urgent thing with **Start** and **Plan**. Under it, exams in the next 10 days with how much prep is on the calendar (red when it's under 3 hours with less than 4 days to go).
- **Start from any row:** hover a row and press **Start** (or G). The timer goes on that deadline and opens full screen; time already running for something else is logged first. The row shows the running time while it's on, and "Xm worked" afterwards.
- **Plan it:** a deadline in the next two weeks with nothing planned has a **Plan 1h/1.5h/2h** button right on the row (2h for essays and exams, 1.5h for psets, labs and reports, 1h otherwise). It adds a Study block in the next free slot before it's due.
- **Mark done:** the circle on a row, the D key, or dragging it to Completed. Finished assignments also disappear from the phone board and widget.
- **Star and reorder:** the star on a row (or S) pins it to Starred at the top. Drag rows to reorder them inside a group. Dates can't be changed by dragging. The order and stars are saved to the calendar script, so they're the same on every computer.
- **Find 1h / 2h:** adds a Study block in the first free slot before it's due.
- **Classes:** a card per class this semester with its next class, what's due soon and the next work block. Clicking a class (or picking it in the sidebar) filters the to-do list to just that class.
- **Courses follow your calendar:** the board has the names, colors and title patterns for every course in the four-year plan built in, but only shows the ones on the Classes calendar right now, so it switches over by itself each semester.
- **Right side:** the night check-in (each block with Done / Partly / Missed, then **Looks right**), the fresh-start offers, and today's schedule.
- **Editing:** see "Changing things" below.
- **Adding things:** **New task** (or N) opens one box for tasks and blocks. Type it the way you'd say it and the chips underneath fill themselves in: `Econ PS7 fri 18:00`, `lit hum essay tmr !` (! stars it), `chinese quiz wed before class` (due when that class starts), `reading response nov 20 #econ`, `in 3 days`, `next mon 9am`. Click a chip to change it: due day (quick picks plus a month calendar), time, class, type (exam, quiz, essay, reading…), star, notes. Switch to **Block** (or press B) for Study time: day, start, length (30m–3h), class, place, and which deadline it's for; it warns when it overlaps something. Enter adds and keeps the box open for the next one. Each group also has its own "+ Add a task" row with the date filled in.
- **Ctrl/⌘ K:** search tasks, blocks and classes, or type a task anywhere and add it as a task or a block.
- **Right-click anything** (or the ⋯ on a row, or M): rename, change date, time, class or type, move to tomorrow, plan time, start the timer, duplicate, done, delete. Double-click a name to rename it in place; click a due date to move it. Delete removes your own tasks and blocks (Canvas items change in Canvas).
- **Timeline:** today on the right is a real day view. Drag on empty time to make a block (a small box asks for the title, length and class), drag a block to move it, drag its bottom edge to change its length, drop a to-do on it to plan time for it, Alt ↑/↓ nudges a selected block 15 minutes.
- **Undo:** every change shows up right away with a toast at the bottom; most have **Undo**, and Ctrl/⌘ Z undoes the last one.
- **Repeating tasks:** add `every mon`, `every tue and thu`, `weekly`, `daily` or `weekdays`, plus `x6`, `for 6 weeks` or `until dec 10` (or use the **Repeat** chip). Each one is its own event, so each can be moved or ticked off; Undo removes the whole set.
- **Paste a list:** paste several lines (a syllabus, an email) into the box and it offers to add each line as a task, reading dates and classes from each line.
- **Checklists and notes:** open a task and type steps under it; the row shows ☑ 2/5. Links in the notes become clickable, and the row gets a ↗ link to the first one.
- **Select several:** ⌘/Ctrl-click or Shift-click rows (or X) to mark them done, move them to a day, change their class, star, plan time or delete them all at once.
- **Plan my week:** next to the title. Lists everything due in the next 7 days with no time planned; untick or change lengths, and it puts each in the first free slot before it's due (one Undo for all).
- **Templates:** blocks for readings, problem sets, essays, lab reports, exam review and flashcards come with a length, learning modes and steps. The block box picks one from the title; change it with the **Template** or **Kind** buttons.
- **Week strip and load:** above the timeline, each day shows how much study is planned (red past the 6-hour cap) and dots for what's due; click a day to see it. "3h 30m study planned of 6h" is the selected day.
- **Filters:** All, Not planned, Exams & quizzes, Added by me, From Canvas.
- **Class and type** are saved as part of the name ("Econ PS7", "… exam"), because that's what every board, the widget and the evening email read. **Notes** go in the calendar event's description.
- **Keys:** ↑ ↓ (or J K) move between tasks, Enter opens, D done, S star, G start the timer on it, F full-screen timer (Esc leaves it, Space starts or pauses). The list is folded under **Keyboard shortcuts** in the sidebar.

## Changing things

**On the desktop board** (quick, one-off changes):
- **Study blocks:** click one in the day list (the arrows page through the past week and the next two), the Now card's **Edit**, or **Edit block** under a deadline. You can change the title, day and time (or nudge it with ← 15 min, 15 min →, Shorter, Longer, Day before, Day after), place, steps (add, rename, tick, reorder, remove, mark as digest), learning mode, and how it went. **Next free slot** moves it to the first gap that fits the 70% rule, and **Duplicate** copies it right after. **Delete** asks twice and offers Undo. Times are typed 24-hour: `930` becomes 09:30.
- **New block:** **+ Block** on the day list, or **Pick a time…** under a deadline (its name is filled in).
- **Deadlines:** "Add a deadline" at the top of To do: type a name, pick a day, add a time if there is one, press Enter. It goes on your personal calendar as "Name due 18:00". Open any deadline and use **Edit name or date** to change or delete one you added. Done and star work on everything.

**In Google Calendar** (repeating, structural or bulk changes): classes, sleep, meetings, anything that repeats, colors and sharing, and moving a lot of blocks around a week at once. Every event on the board has a **Google Calendar ↗** link that opens it there. Canvas items change in Canvas; their **Canvas ↗** link opens the assignment when Canvas is read through its feed.

## Deadlines you can rely on

The deadline rules live in one file, `rules.js`, used by the phone board, the desktop board, the widget and the calendar script, so every screen agrees.

- **What counts:** everything in Canvas; calendar events with "due", "deadline" or "submit" in the title (any length, "Study guide due" included); exams and quizzes, but not "review" or "prep" sessions; and all-day events like "Pset 6" or "Essay 3". Study blocks never count. It errs toward showing too much.
- **When it's due:** the start of a timed event (the earliest it could mean), or a time written in an all-day title ("due 6 PM", "due at 11:59pm", "due 18:00"). An all-day deadline with no time is shown on its day from midnight.
- **Duplicates:** the same title on the same day (one event on two synced calendars) shows once. A Canvas item and your own entry merge only when they share the assignment number and kind of work, and then the earlier date wins. Two different assignments are never merged, even for the same class on the same day.
- **How far ahead:** six weeks for deadlines (`DEADLINE_DAYS`), two weeks for the schedule.
- **Never hidden for space:** anything due within 36 hours and the next exam or quiz in 10 days always get a row on the phone and the widget. The rest say "+3 more · next Thu …". The desktop lists everything.
- **Passed today:** stays on screen, faded, until the day ends, in case it wasn't handed in.
- **When something might be missing:** if any calendar fails to load, or a screen hasn't synced for 3 hours, the phone, desktop and widget all say so in red.
- **Canvas directly (recommended):** Google refreshes a subscribed Canvas calendar only every several hours. In Canvas, open Calendar → **Calendar Feed** and copy the link. In Apps Script, open Project Settings → Script properties → add `CANVAS_ICS_URL` with that link. The script then reads Canvas itself: a background job refreshes it every 15 minutes (skipping 02:00–08:00) (Canvas can take 20+ seconds to answer, so the boards never wait on it), and it falls back to the Google calendar if Canvas can't be reached. Run `setup` once after adding the link to start the job.
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

