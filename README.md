# ForecastIQ — AI Predictive Forecasting Tool

> NatWest Group · Code for Purpose India Hackathon

---

## Overview

ForecastIQ is an AI-powered sales forecasting tool that transforms historical sales data into actionable predictions. Upload a sales CSV, ask questions in plain English, and instantly receive revenue forecasts, demand predictions, anomaly alerts, scenario simulations, driver analysis, and multivariate forecasting — all explained in clear, jargon-free language. No data science skills required.

It is built for sales managers tracking weekly revenue targets, retail and e-commerce teams planning inventory and demand, finance teams running profit and cost projections, regional heads monitoring performance across territories, and operations teams who need to act on early warning signals before problems escalate.

---

## Features

### Analytics & Intelligence
- **Short-term forecasting** — predicts metric values (revenue, units sold, profit, etc.) for 1–6 weeks ahead using ARIMA and Exponential Smoothing models, with low/likely/high confidence bands
- **Anomaly detection** — flags unusual spikes and dips in any metric, with severity scoring (mild / moderate / severe) and plain-English next-step guidance; anomaly points are highlighted directly on the chart
- **Scenario simulation** — models flat %, growth, and decline scenarios side by side against a baseline naive forecast
- **Best/worst case analysis** — generates optimistic (+20%) and pessimistic (−20%) forecast envelopes in a single view
- **Dimension ranking** — ranks categories and regions by forecasted revenue performance with growth % and weekly averages
- **Driver analysis** — identifies which columns have the strongest correlation with a target metric
- **Impact simulation** — models how a % change in one metric (e.g. `marketing_spend`) flows through to another (e.g. `revenue`) using multivariate regression
- **Lead indicator detection** — tests whether one metric predicts another in advance across lag windows
- **Multivariate forecasting** — forecasts a target metric using correlated features via linear regression

### Dashboard & Visualisation
- **Split-panel layout** — dashboard on the left, AI chat assistant on the right
- **CSV data preview** — full paginated, searchable table of your uploaded data visible directly in the dashboard — no need to open the file separately
- **KPI cards** — headline metrics at a glance: latest value, Week 1 forecast with real calendar date, growth %, best category, region to watch, and anomaly count; each card has an ⓘ tooltip explaining what the number means
- **Forecast confidence meter** — rates forecast reliability 0–100 based on data length, volatility, and seasonality; an ⓘ button shows exactly how the score is broken down (data length score, low volatility score, seasonality bonus)
- **Category rankings** — bar chart ranking all product categories by forecasted weekly revenue with growth % indicators
- **Region signals** — signal cards per region showing growth trend and anomaly status (Stable / Strong Growth / Declining / Anomaly Detected / Anomaly + Surge / Anomaly + Decline)
- **Forecast chart** — area chart showing historical data, forecast with confidence bands, and a dashed naive baseline line for direct comparison; anomaly points are marked with glowing red dots

### User Experience
- **Onboarding tour** — a 4-step guided walkthrough shown to first-time users explaining how to upload data, read the dashboard, ask questions, and interpret results; accessible at any time via the **?** help button in the top navigation
- **Dark / light theme toggle** — switchable between dark and light mode to suit presentation environments and personal preference
- **Mobile responsive layout** — adapts to smaller screens with a tab-based navigation between dashboard and chat views
- **Drag and drop upload** — CSV files can be dragged directly onto the dashboard; the drop zone glows blue on hover and accepts any CSV with a date column
- **Natural language chat** — parses user questions into structured intents using GPT-4o; no dropdowns or form fields required
- **Follow-up suggestions** — after every AI response, 2 contextual follow-up question chips appear so users always know what to ask next
- **Copy button** — one-click copy on every AI response to paste summaries into reports, emails, or Slack
- **Chat history** — full scrollable session history accessible via the History button in the chat header
- **Model auto-selection** — automatically picks the best-fit model (ARIMA vs ETS) per dataset using AIC scoring

---

## Sample Dataset

The tool is tested and demonstrated using a synthetic weekly sales dataset (`sales_data_100_enriched.csv`) with the following structure:

| Column | Type | Description |
|---|---|---|
| `date` | date | Week start date — **required column, must be named `date`** |
| `product_category` | text | Product category — Electronics, Clothing, Groceries, Furniture, Sports |
| `region` | text | Sales region — North, South, East, West |
| `units_sold` | numeric | Number of units sold that week |
| `revenue` | numeric | Total revenue generated |
| `profit` | numeric | Gross profit |
| `new_customers` | numeric | New customers acquired |
| `returning_customers` | numeric | Repeat customers |
| `churn_rate` | numeric | Proportion of customers lost (0–1) |
| `orders` | numeric | Number of orders placed |
| `avg_order_value` | numeric | Average revenue per order |
| `returns_units` | numeric | Units returned |
| `return_rate` | numeric | Proportion of units returned (0–1) |
| `marketing_spend` | numeric | Spend on marketing that week |
| `operating_cost` | numeric | Operational expenses |
| `net_profit` | numeric | Profit after operating costs |
| `inventory_units` | numeric | Units in stock |
| `stockout_days` | numeric | Days with zero stock that week |

> **Important:** Your CSV must contain a date column. Common synonyms such as `week`, `order_date`, `transaction_date`, and `period` are automatically recognised and renamed. All other columns are detected automatically — no configuration required.

---

## Supported Question Types

The chat interface understands **13 question patterns** across 5 use cases. Questions can be phrased naturally — the AI parser handles all variations.

---

### 📈 FORECASTING

**Q1 — Overall metric forecast**

Template: `"What will [metric] look like for the next [N] weeks?"`

Variations:
- "Forecast `[metric]`"
- "Predict `[metric]` for next `[N]` weeks"
- "What's the outlook for `[metric]`?"
- "Give me a `[metric]` forecast"
- "What are the expected `[metric]` numbers?"

Examples:
- *"What will revenue look like for the next 4 weeks?"*
- *"Predict net_profit for the next 6 weeks"*

---

**Q2 — Filtered forecast by category and region**

Template: `"Forecast [metric] for [category_value] in [region_value] for next [N] weeks"`

Variations:
- "What will `[category_value]` sell in `[region_value]`?"
- "Predict `[metric]` for `[category_value]` region `[region_value]`"
- "How will `[category_value]` perform in `[region_value]`?"
- "`[category_value]` sales forecast for `[region_value]`"
- "Expected `[metric]` for `[category_value]` in `[region_value]` next `[N]` weeks?"

Examples:
- *"Forecast units_sold for Electronics in North for next 6 weeks"*
- *"What will Furniture sell in West over the next 4 weeks?"*

---

**Q3 — Best performing dimension**

Template: `"Which [dimension] is expected to perform best next [N] weeks?"`

Variations:
- "Best performing `[category/region]`?"
- "Which `[dimension]` will lead in `[metric]`?"
- "Top `[category/region]` next month?"
- "Which `[dimension]` should I focus on?"
- "Rank `[categories/regions]` by expected `[metric]`"

Examples:
- *"Which category is expected to perform best next 4 weeks?"*
- *"Which region will generate the most revenue next month?"*

---

### 🔴 ANOMALY DETECTION

**Q4 — Anomalies in a metric**

Template: `"Are there any sudden changes in [metric]?"`

Variations:
- "Any anomalies?"
- "Anything unusual I should know about?"
- "Any spikes or dips?"
- "Flag anything abnormal in `[metric]`"
- "Is `[metric]` behaving normally?"
- "Any red flags in the data?"

Examples:
- *"Are there any sudden changes in churn_rate?"*
- *"Any unusual spikes or dips in return_rate I should know about?"*

---

**Q5 — Filtered anomaly by category and region**

Template: `"Any unexpected [spike/dip] in [metric] for [category_value] in [region_value]?"`

Variations:
- "Is `[category_value]` behaving normally in `[region_value]`?"
- "Any issues with `[category_value]`?"
- "Check `[category_value]` in `[region_value]` for anomalies"
- "Did `[category_value]` sales drop unexpectedly in `[region_value]`?"
- "Any unusual activity for `[category_value]` in `[region_value]`?"

Examples:
- *"Any unexpected dip in revenue for Furniture in West?"*
- *"Is Electronics behaving normally in the North region?"*

---

**Q6 — Most anomalous dimension**

Template: `"Which [dimension] has the most unusual activity?"`

Variations:
- "Which `[region/category]` is most volatile?"
- "Where are the biggest anomalies?"
- "Which `[category/region]` has the most issues?"
- "Show me the most unstable `[region/category]`"
- "Which `[dimension]` should I investigate first?"

Examples:
- *"Which region has the most unusual activity?"*
- *"Which product category is showing the most anomalies?"*

---

### 🔀 SCENARIO SIMULATION

**Q7 — Percentage growth or drop scenario**

Template: `"What if [metric] grows/drops by [N]%?"`

Variations:
- "Simulate `[N]`% increase in `[metric]`"
- "What happens if `[metric]` falls by `[N]`%?"
- "Model a `[N]`% rise in `[metric]`"
- "How does a `[N]`% drop in `[metric]` affect the forecast?"
- "Project `[metric]` with a `[N]`% uplift"

Examples:
- *"What if revenue grows by 15%?"*
- *"What happens if marketing_spend drops by 10% next month?"*

---

**Q8 — Flat trend scenario**

Template: `"What if we keep [time_reference] trend?"`

Variations:
- "Assume flat growth"
- "Hold current trajectory"
- "No change scenario for `[metric]`"
- "What if growth stays the same as last month?"
- "Forecast with no change from `[time_reference]`"

Examples:
- *"What if we keep last month's trend for net_profit?"*
- *"Assume flat growth — what does revenue look like for the next 4 weeks?"*

---

**Q9 — Best case vs worst case**

Template: `"Show me best case vs worst case for [metric]"`

Variations:
- "What's the upside and downside?"
- "Give me optimistic and pessimistic forecast for `[metric]`"
- "Best and worst scenario for `[metric]`"
- "What's the range of possible outcomes for `[metric]`?"
- "Show me the upside and downside risk for `[metric]`"

Examples:
- *"Show me best case vs worst case for units_sold"*
- *"What's the upside and downside for revenue over the next 4 weeks?"*

---

### 🔍 DRIVER ANALYSIS & IMPACT SIMULATION

**Q10 — Driver analysis**

Template: `"What is driving [metric]?"`

Variations:
- "What factors influence `[metric]` the most?"
- "Which columns impact `[metric]`?"
- "What is correlated with `[metric]`?"
- "What causes changes in `[metric]`?"
- "Show me the top drivers of `[metric]`"

Examples:
- *"What is driving revenue?"*
- *"What factors influence net_profit the most?"*

---

**Q11 — Impact simulation**

Template: `"If [metric_a] increases by [N]%, what happens to [metric_b]?"`

Variations:
- "How does a `[N]`% change in `[metric_a]` affect `[metric_b]`?"
- "Model the effect of `[metric_a]` on `[metric_b]`"
- "What is the impact of increasing `[metric_a]` by `[N]`% on `[metric_b]`?"
- "Simulate `[N]`% uplift in `[metric_a]` and show effect on `[metric_b]`"

Examples:
- *"If marketing_spend increases by 10%, what happens to revenue?"*
- *"How does a 20% drop in new_customers affect net_profit?"*

---

**Q12 — Lead indicator detection**

Template: `"Does [metric_a] predict [metric_b] in advance?"`

Variations:
- "Is `[metric_a]` a leading indicator for `[metric_b]`?"
- "Can `[metric_a]` be used to predict `[metric_b]` ahead of time?"
- "Is there a lag between `[metric_a]` and `[metric_b]`?"

Examples:
- *"Does marketing_spend predict revenue in advance?"*
- *"Is stockout_days a leading indicator for returns_units?"*
- *"Does new_customers move before revenue?"*

---

**Q13 — Multivariate forecast**

Template: `"Forecast [target_metric] using [driver_metric] for the next [N] weeks"`

Variations:
- "Predict `[target_metric]` factoring in `[driver_metric]` for next `[N]` weeks"
- "Forecast `[target_metric]` with `[driver_metric]` as a feature"
- "Use `[driver_metric]` to forecast `[target_metric]`"
- "Multi-factor forecast for `[target_metric]` including `[driver_metric]`"

Examples:
- *"Forecast revenue using marketing_spend for the next 4 weeks"*
- *"Predict orders factoring in marketing_spend for next 6 weeks"*
- *"Forecast net_profit using operating_cost for next 4 weeks"*

---

### Placeholders Reference

| Placeholder | Accepted values |
|---|---|
| `[metric]` | Any numeric column — `revenue`, `units_sold`, `profit`, `net_profit`, `churn_rate`, `marketing_spend`, etc. |
| `[dimension]` | `category`, `region` |
| `[category_value]` | `Electronics`, `Clothing`, `Groceries`, `Furniture`, `Sports` |
| `[region_value]` | `North`, `South`, `East`, `West` |
| `[N]` | Any number — defaults to 4 if not specified |
| `[time_reference]` | `last month`, `last week`, `last quarter` |
| `[driver_metric]` | Any numeric column that influences another — e.g. `marketing_spend`, `stockout_days`, `new_customers` |
| `[target_metric]` | The metric you want to predict or analyse — e.g. `revenue`, `orders`, `net_profit` |

---

## Project Structure

```
NATWEST_Hackathon/
├── src/
│   ├── backend/
│   │   ├── main.py              # FastAPI app — all API routes
│   │   ├── models.py            # Forecasting models (ARIMA, ETS, anomaly detection)
│   │   ├── explainer.py         # AI explanation layer (GPT-4o via GitHub Models)
│   │   ├── scenario.py          # Scenario simulation (flat, seasonal, remove outliers)
│   │   ├── multivariate.py      # Driver analysis, impact simulation, lead indicator, multivariate forecast
│   │   └── backtest.py          # Model backtesting utilities
│   └── frontend/
│       ├── src/
│       │   ├── ChatApp.jsx       # Main app — dashboard, chat interface, all visualisations
│       │   └── main.jsx          # React entry point
│       ├── index.html
│       ├── package.json
│       └── vite.config.js
├── assets/
│   └── sample_data/
│       ├── sales_data_100_enriched.csv   # Primary demo dataset (100 rows, 18 columns)
│       └── ...
├── test_chat.py
├── test_forecast.py
├── test_insights.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.13, FastAPI, Uvicorn |
| **Forecasting models** | statsmodels (ARIMA, Exponential Smoothing), scikit-learn (Linear Regression) |
| **AI / NLP** | GPT-4o via GitHub Models (Azure inference endpoint) |
| **Data processing** | pandas, numpy |
| **Frontend** | React 18, Vite, Recharts |
| **API communication** | REST (JSON), multipart/form-data for file upload |

---

## Install and Run

### Prerequisites

- Python 3.10 or higher
- Node.js 25 or higher
- A GitHub personal access token with access to GitHub Models (for GPT-4o)

---

### 1. Clone the repository

```bash
git clone https://github.com/sam-1002/NATWEST_Hackathon.git
cd NATWEST_Hackathon
```

---

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your token:

```
GITHUB_TOKEN="your_github_personal_access_token_here"
```

> Generate a token at https://github.com/settings/tokens — it must have access to GitHub Models.

---

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Start the backend

```bash
uvicorn src.backend.main:app --reload
```

API available at `http://127.0.0.1:8000` — verify at `http://127.0.0.1:8000/health`

---

### 5. Install and start the frontend

```bash
cd src/frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`

---

## Usage Examples

### Upload and explore

1. Open `http://localhost:5173`
2. Complete the onboarding tour on first visit, or skip it and return to it any time via the **?** button
3. Drag and drop a CSV onto the dashboard, or click **Upload CSV** — the file must contain a date column
4. The dashboard loads automatically with revenue forecast, category rankings, region signals, CSV data preview, and KPI cards
5. Switch between dark and light mode using the theme toggle in the top navigation
6. Ask questions in the chat panel on the right — follow-up suggestions appear after every answer

### Direct API call

```bash
curl -X POST "http://127.0.0.1:8000/chat" \
  -F "file=@assets/sample_data/sales_data_100_enriched.csv" \
  -F "question=What will revenue look like for the next 4 weeks?"
```

---

## Architecture

```
User (Browser)
     │
     ▼
React Frontend (Vite)
     │  multipart/form-data (CSV + question)
     ▼
FastAPI Backend
     ├── models.py         → ARIMA / ETS forecast + anomaly detection
     ├── scenario.py       → flat / seasonal / outlier-removal scenarios
     ├── multivariate.py   → driver analysis, impact simulation, lead indicator, multivariate forecast
     └── explainer.py      → GPT-4o → plain-English summary
```

---

## Data Privacy & AI Transparency

**Your data never leaves your server.** All CSV files are processed locally on your own machine. The AI layer (GPT-4o) only receives aggregated statistical summaries — forecast values, anomaly scores, and metric averages — never the raw rows of your data. Your business data remains entirely under your control.

**AI responses may not always be accurate.** ForecastIQ uses AI to generate plain-English explanations of statistical outputs. While it aims to be helpful and specific, AI can make mistakes in interpretation or emphasis. Always cross-check AI-generated summaries against the underlying numbers shown in the charts before making business decisions.

---

## Limitations

- Accepts CSV files only — Excel (.xlsx) is not currently supported
- Forecasting accuracy degrades with fewer than 20 data points after aggregation
- The AI explanation layer requires a valid GitHub token with GitHub Models access; if unavailable, the app falls back to a static summary string
- The app is stateless — data is not persisted between sessions
- Best/worst case uses fixed ±20% — custom ranges are not yet configurable
- Multivariate forecasting assumes linear relationships between features and target

---

## Future Improvements

- Excel (.xlsx) file upload support
- User-configurable best/worst case percentage ranges
- Export forecast results as CSV or PDF
- Persistent session storage for comparing forecasts across uploads
- Cloud deployment with authentication
- Non-linear multivariate models (e.g. XGBoost)

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `GITHUB_TOKEN` | GitHub personal access token for GPT-4o access via GitHub Models | Yes |

See `.env.example` for the full template.

---

## Running Tests

```bash
python test_forecast.py
python test_chat.py
python test_insights.py
```

---

## License

Apache License 2.0 — see repository for full terms.
