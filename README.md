# Desk Board

A full-screen desk display for a spare iPhone. It shows the time, the calendar block you're in and its first step, a focus timer, what's due in the next two weeks, and today's schedule.

```
site/          the page you host (index.html, shorten.js, icons)
apps-script/   Code.gs, the small Google script that reads your calendars
```

How it fits together:

- **Code.gs** runs on your Google account. It reads your main calendar, your Study Calendar and the Canvas feed, keeps the focus timer in sync, and writes check-ins and pomodoro counts back onto your Study Calendar blocks.
- **index.html** is a static page. It asks the script for data every 2 minutes. Your script URL and key are stored only on your devices, never in the page, so the page itself can be public.

---

## 1. Set up the script (laptop, about 5 minutes)

Use the Google account that owns your calendars.

1. Go to **script.google.com** → **New project**. Rename it "Desk Board".
2. Delete what's in the editor, paste in all of `apps-script/Code.gs`, and save.
3. Open **Project Settings** (gear icon) and check that the time zone is **America/New_York**.
4. Back in the editor, choose **setup** from the function menu and press **Run**.
   - Approve access. If Google says it hasn't verified the app, click **Advanced → Go to Desk Board**. It's your own script.
   - Open the **Execution log**. It lists the calendars it found and prints **Your board key**. Check that it found `study` and `canvas`. Copy the key.
5. **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Press **Deploy** and copy the **Web app URL** (it ends in `/exec`).

**Test it.** In a private browser window, open:

```
YOUR_WEB_APP_URL?action=ping&key=YOUR_KEY
```

You should see `{"ok":true,...}`.

If you get a sign-in page instead, or "Anyone" wasn't an option, your school account doesn't allow public web apps. The board can't use this script in that case. The fallback is reading the calendars' private iCal links through a small Cloudflare Worker instead.

**Changing the script later:** use **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL.

## 2. Host the page (about 5 minutes)

**GitHub Pages**

1. On github.com create a new **public** repository, for example `desk-board`.
2. **Add file → Upload files**, then upload all four files in `site/`. Commit.
3. Go to **Settings → Pages** and choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. After a minute the board is at `https://YOUR-USERNAME.github.io/desk-board/`.

**Cloudflare Pages** works too: go to **Workers & Pages → Create → Pages → Upload assets** and drop in the `site` folder.

## 3. Connect and put it on the iPhone

1. On your laptop, open the hosted page. It asks for the **web app URL** and **key**. Paste them and press **Connect**.
2. Press **Copy phone link** and send it to the iPhone (AirDrop, Notes, or Messages).
3. On the iPhone, open that link in **Safari**, then **Share → Add to Home Screen**. Leave **Open as Web App** on and add it.
4. Open the board from the new icon. It runs full screen with no browser bars.
5. Lock it in place:
   - **Settings → Accessibility → Guided Access**: on, with **Display Auto-Lock → Never**
   - Open the board and **triple-click the side button → Start**
   - **Settings → Battery → Charging**: 80% limit, since it lives on the charger

**To reconnect or see the phone link again:** hold the date under the clock for one second.

## Using it

- **Planning:** add blocks to your **Study Calendar**. Put steps in the event description as lines starting with `- `. The first step shows on the board as "Start with …".
- **Due soon:** comes from Canvas plus any event with "due", "quiz", "exam", "test" or "midterm" in the title. When Canvas and your own marker disagree, Canvas's date wins. Each deadline shows how much work time is blocked for it, and anything due within a week with none shows **no time blocked**.
- **Check-ins:** when a Study block ends, tap **Done**, **Partly** or **Missed**. The block turns green, yellow or red on your calendar and gets a `Check-in:` line. Follow-through for the day and week shows under the timer.
- **Focus timer:** 25 minutes of focus, then a 5-minute break. Each finished pomodoro is counted for the day and added to the block you were in (a `Pomodoros:` line on the event). The timer stays in sync across devices.
- **Tomorrow:** when today's last block ends, the main card switches to tomorrow's first block and what's due tomorrow.

## How long titles are shortened

Calendar and Canvas titles go through `shorten.js` before they're shown. It builds shorter and shorter versions of each title and shows the longest one that fits its space:

| On the calendar | On the board (tight space) |
|---|---|
| Week 6 Lesson 4, Exercise #1 & #3 [CHNSUN1011… - INTRODUCTORY CHINESE B] | Chn L4 Ex 1+3 |
| Weekly Reading 5: Trade and Macro Aggregates [UN 1105] | Wkly Rdg 5 |
| Lab Report 5 [PHYSUN1494… - INTRO TO EXPERIMENTAL PHYS-LAB] | Phys Lab Rpt 5 |
| Lit Hum Quiz 3 · Odyssey 9–16 | Lit Hum Quiz 3 +1 |
| Write addFront, traverseList, flipSignDouble, compareDouble | Write addFront +3 |

To teach it a new abbreviation, add a word to `WORDS` (or a phrase to `PHRASES`) at the top of `shorten.js`. Course names from Canvas are matched in `COURSES`.
