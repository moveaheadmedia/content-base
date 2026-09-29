# Content Base

Content Base is the Move Ahead Media content team's workflow tool. It's one web page where:
- the team books, tracks and schedules content
- writers see and submit their own work

It replaces the separate monthly sheet each writer has today.

- **Live link (once GitHub Pages is switched on):** https://moveaheadmedia.github.io/content-base/
- **Full plan:** the team doc *Content Base Tool Plan*

> **Right now this is the practice version.** Everything in it is made-up, and the "Sign in with Google" button isn't switched on yet. Both arrive in round 2.

---

## Where we are

| Round | What it brings | Status |
|---|---|---|
| 1. Practice version | All main screens, made-up data, due-date suggestions, practice sign-in for each role, the admin Settings page, and the Move Ahead Media look | **Built** |
| 2. Go live | A new company Google Sheet to hold the real data, the Google script that guards it, and a working "Sign in with Google" | Next |
| 3. Reshuffle and totals | Sick days, leave and urgent work move due dates automatically; ready-made Slack messages for AMs; monthly totals per writer | Later |
| 4. Connections | Automatic Slack and ClickUp updates, emails to writers, and a move to Supabase if the sheet gets too slow | When needed |

---

## Who can do what

| | Admin | Content team | Writer |
|---|---|---|---|
| See content | All | All | Only their own pieces |
| Book content, change due dates, move stages | Yes | Yes | Only **Accept** and **Submit** |
| See cost | Yes | Yes | No |
| Add clients, time off and holidays | Yes | Yes | No (writers tell the team) |
| Change writers and rates | Yes | View only | No |
| Settings page, delete pieces | Yes | No | No |

---

## Trying the practice version

1. Open the link (or run it on your own computer; see *For developers*).
2. Under **Practice sign-in**, choose who you want to be:
   - **Sam Carter**: Admin
   - **Mia Lopez**: Content team
   - **Ava Reed, Leo Grant, Pim Suda**: writers
3. To try a different role, click **Switch person** (bottom left).

### Learn the tool in 8 steps

These steps follow one piece of content through the whole process, the same way the team works today.

| Step | Who | What to do |
|---|---|---|
| 1. Look around | Mia | Read the five numbers on the Dashboard. Check the **Writer week** (use **‹ Previous** to see who delivered what last week). Click **Overdue** to open that piece. |
| 2. Book a piece | Mia | **Book content** → choose *Green Leaf Café* and type 1000 words. The tool picks the writer and suggests a due date. Click **Book content**. |
| 3. Writer's side | Leo | **My work** → **Accept** the new piece, paste any `https://` link, then click **Submit**. |
| 4. Check it | Mia | Open the piece → **Move to Formatting** → **QC** → tick *Summary added* and set *QC by* → **With AM** → **With client**. |
| 5. Client wants changes | Mia, then Leo | Mia: **Send for revisions** with the feedback. Leo: read it under *Revisions needed*, then **Submit revision**. |
| 6. Finish | Mia | **With AM** → **With client** → **Client approved** → **Sent to design/dev**. **Sheet view** shows every column filled in. |
| 7. Someone is sick | Mia | **Time off & holidays** → add *Sick* for a writer. The Dashboard shows it straight away. On their late piece, click **Suggest**, tick **Pin this date**, then save. |
| 8. Admin jobs | Sam | **Writers**: change a daily limit. **Settings**: add a person, rename a list value, add your own field, rename a stage. |

### Tips
- **Your practice changes stay in your own browser.** Colleagues won't see them, and Chrome and Safari each keep their own copy.
- **Reset practice data** (at the top of every page) brings back the original made-up data.
- If a page looks out of date after an update, press **Cmd + Shift + R** (Mac) or **Ctrl + Shift + R** (Windows) to reload it fully.
- Red tags such as **Overdue** or **Past needed-by** are warnings, not stages. A piece at any stage can have one.
- **Pin** a due date you've promised to someone. The automatic reshuffle in round 3 will never move it.

---

## What each screen does

- **Dashboard:**
  - counts that need attention
  - the **Writer week**: words booked against each writer's daily limit, with time off shown. Past days show what was actually delivered, and any late deliveries.
  - what needs a decision, and what's due next
- **Content:** every piece in one list.
  - Filter by month, writer, client, AM, stage, priority, language, type, who booked it and who checked it.
  - **Sheet view** shows every column from the old sheets.
  - Click a row to edit it, move its stage, send it for revisions, and see who changed what.
- **Book content:** pick the client, and the tool fills in the usual writer, AM and language, then suggests the earliest realistic due date. It warns you if:
  - the date is after the *needed by* date (and suggests the backup writer)
  - the booking pushes other pieces later
- **Writers:** each writer's daily word limit for each weekday, their rate (USD per word) and their languages.
- **Clients:** each client's language, AM, usual writer and backup writer.
- **Time off & holidays:** writers tell the content team, who add it here. Holidays are added by hand. Due dates skip these days, and weekends.
- **My work (writers):** their pieces with the simpler stage names, **Accept** and **Submit** buttons, and revision feedback. Writers never see pay.
- **Settings (admin only):**
  - **People:** add team members and writers, change roles, remove or give back access, and edit AMs. Removing access keeps past work.
  - **Lists:** add, rename, reorder or remove Languages, Content types and Time off reasons. Renaming a value also updates every piece that uses it.
  - **Fields & columns:** rename any field, choose which columns show in Compact and Sheet view, and add your own fields (text, number, date, link, tick box or dropdown). Tick **On booking form** to have one of your own fields filled in when a piece is booked.
  - **Stages:** rename stages, separately for the team and for writers.
  - **General:** the tool's name, and a button to reset all settings.

## The 10 stages

**Booked → With writer → Submitted → Formatting (Links team) → QC → With AM → With client → Revisions → Client approved → Sent to design/dev**

- If the client wants changes, the piece goes to **Revisions**, and back to **QC** when the writer resubmits. Each loop counts as a revision round.
- Writers see simpler names: **New → In progress → Submitted → Revisions needed → Done**.

## How due dates are worked out

1. Each writer has a daily word limit for each weekday.
2. Weekends, holidays and the writer's time off are skipped.
3. Pieces fill the writer's days in order: Urgent, then High, then Normal. Within the same priority, the earliest booked goes first.
4. A long piece spreads over several days. Its due date is the day its last words fit.
5. A **pinned** date never moves. Its words are taken from the days just before it.
6. New work starts the next working day after it's booked.

## Look and feel

The design follows the Move Ahead Media website (moveaheadmedia.co.th), the same as mam-th-quiz:
- **Colours:** brand red `#EC3737`, near-black `#15171E`, white, and light grey `#F1F1F1`.
- **Type:** Be Vietnam Pro, with Noto Sans Thai for Thai text. Headings are extra-bold.
- **Shapes:** square corners, and bold uppercase buttons.
- **Logo:** loaded straight from the company website.

## Rules that keep this safe

- **No real client, writer or staff details ever go into this code.** Anyone can read it on GitHub. Real data will live in the private company Google Sheet from round 2.
- For Google sign-in we only ever need the **Client ID**, which is public. **A Client secret must never be put here.**
- Writers will never get access to the Google Sheet itself. The Google script checks who is signed in and hands back only their own work.

---

## For developers

Plain HTML, CSS and JavaScript (ES modules). There's no build step and nothing to install.

```bash
python3 tools/dev-server.py   # run it locally, then open http://localhost:8000
npm test                      # automatic checks (needs Node 20 or newer)
```

Opening `index.html` by double-clicking it won't work, because browsers won't run a page's code from a file. Use the test server.
`tools/dev-server.py` tells the browser not to keep old copies, so a normal refresh always shows your latest change.

### How the code is organised

| File | What it does |
|---|---|
| `index.html` | The page itself: loads the fonts, the styles and `app.js` |
| `assets/css/styles.css` | The whole look, in one file. Brand colours are at the top |
| `assets/js/app.js` | Sign-in, the side menu, moving between screens, and who can do what |
| `assets/js/config.js` | Starting values: default lists, stage names, rates, the storage mode, and the Google Client ID (round 2) |
| `assets/js/settings.js` | What the admin changes on the Settings page, laid on top of the starting values |
| `assets/js/store.js` | **The only place that saves data.** Round 1 saves in the browser; round 2 adds a Google Sheet version with the same functions, so no screen has to change |
| `assets/js/schedule.js` | The due-date rules (tested in `tests/schedule.test.js`) |
| `assets/js/dates.js` | Date helpers. Dates are stored as `YYYY-MM-DD` and shown as DD/MM/YYYY |
| `assets/js/custom-fields.js` | The admin's own extra fields: form inputs and table cells |
| `assets/js/sample-data.js` | The made-up practice data. It uses example.com addresses only |
| `assets/js/ui.js` | Shared pieces: stage tags, warning tags, side panel, messages, icons |
| `assets/js/views/` | One file per screen |
| `tests/` | Automatic checks for the due-date rules, dates, settings and practice data |

### Good to know
- Every row has its own ID (for example `C-0001` or `W-01`), and tabs refer to each other by ID, never by name. Renaming things never breaks links, and moving to the Google Sheet or Supabase stays simple.
- Every change is logged in the **History** tab, with who made it and when.
- `SAMPLE_VERSION` in `sample-data.js`: raise it when the practice data changes shape. Everyone's browser then loads the new practice data.
