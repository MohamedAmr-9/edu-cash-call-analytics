# 📞 Edu Cash — Call Center Analytics

A zero-backend dashboard that turns a raw call-center export (Excel / CSV) into agent-level performance insights — calls, answers, answer rate, average handling time, peak hours and per-call evaluation.

Everything runs **in the browser**. The uploaded file is never sent to a server.

![Dashboard](docs/dashboard.png)

> The screenshot uses synthetic data from `sample-data/sample_calls.csv`.

## Why I built it

Our team exported call logs from the phone system and analysed them by hand in Excel every day. This tool replaces that: drop the file in, get the numbers, export a PDF report.

## Features

- **Agent leaderboard** – Calls, Answers, answer rate, average call time, sortable and searchable
- **Configurable "Answer" rule** – e.g. `Duration > 50 s` (or `≥`)
- **Charts** – Calls vs Answers per agent, and per hour / per day, with tooltips showing the top agents and peak hours
- **Call evaluation** – each agent and each call is flagged *long / OK / short*, either relative to the team average (±%) or with fixed thresholds in minutes
- **Call log** – filter by agent, outcome, answered / not, evaluation; paginated; export to CSV or Excel
- **Agent names** – map extension codes to names (stored locally in the browser)
- **PDF report** – team summary + one page per agent (print → *Save as PDF*)
- Light / dark theme, Arabic RTL interface, responsive

## Run it

No build step.

```bash
git clone https://github.com/MohamedAmr-9/edu-cash-call-analytics.git
cd edu-cash-call-analytics
# just open index.html, or serve it:
python3 -m http.server 8000
```

Then upload `sample-data/sample_calls.csv` to try it.

## Expected input

The first sheet of the file needs at least these columns (matching is case-insensitive):

| Column | Used for | Detected by header |
|---|---|---|
| `Src` | Agent extension code | `src` |
| `Duration` | Call duration in **seconds** | contains `duration` |
| `Start Time` | Date / hour analysis | contains `start`, `time` or `date` |
| `Call_Type` | Outcome (`ANSWERED`, `NO ANSWER`, `BUSY`, `FAILED`…) | `call_type`, `status` or `answer` |
| `Dst` | Dialled number (optional) | `dst` or `dest` |

Rows whose `Src` is outside the configured range (default `100–150`) are dropped, which filters out non-agent extensions.

## Project structure

```
├── index.html          # markup
├── css/style.css       # theme, layout, print styles for the PDF report
├── js/app.js           # all logic (state, settings, parsing, charts, log, PDF)
├── sample-data/        # synthetic call data for demo purposes
└── docs/               # screenshots
```

## Tech

Vanilla JavaScript, SVG charts, CSS variables for theming, [SheetJS](https://sheetjs.com/) for reading/writing Excel. Settings and agent names are persisted in `localStorage`.

## Privacy

- No data is uploaded anywhere; parsing and charts happen locally.
- This repo contains **no real call data or employee names**. Do not commit real exports — `.gitignore` excludes common spreadsheet formats outside `sample-data/`.

## Possible next steps

- Break `app.js` into ES modules + add a bundler
- Unit tests for the aggregation and evaluation logic
- Service-level metrics (abandon rate, wait time) when the export includes them

## License

MIT
