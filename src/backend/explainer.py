import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=os.getenv("GITHUB_TOKEN")
)


def parse_user_question(question: str, schema: dict) -> dict:
    """
    Parses user question into a structured intent object.
    schema = {
        "numeric_cols": ["revenue", "units_sold", "profit"],
        "categorical_cols": {"product_category": ["Electronics", ...], "region": ["North", ...]}
    }
    Returns:
    {
        "intent": one of [forecast, anomaly, best_dimension, anomaly_by_dimension, scenario, scenario_best_worst],
        "metric": "revenue",
        "periods": 4,
        "category_filter": "Electronics" or null,
        "region_filter": "North" or null,
        "dimension": "product_category" or "region" or null,
        "adjustment_pct": 10 or null,
        "direction": "spike" or "dip" or "both",
        "scenario_type": "single" or "flat" or "best_worst"
    }
    """
    numeric_cols = schema.get("numeric_cols", [])
    categorical_cols = schema.get("categorical_cols", {})

    all_cat_values = {}
    for col, vals in categorical_cols.items():
        for v in vals:
            all_cat_values[v.lower()] = (col, v)

    prompt = f"""
You are a query parser for a business forecasting app.

User question: "{question}"

Available data schema:
- Numeric columns (metrics): {numeric_cols}
- Categorical columns: {json.dumps({k: list(v) for k, v in categorical_cols.items()})}

Parse the question and return ONLY a JSON object with these fields:

{{
  "intent": "<one of: forecast, anomaly, best_dimension, anomaly_by_dimension, scenario, scenario_best_worst>",
  "metric": "<which numeric column they want, default to first one if unclear>",
  "periods": <integer weeks ahead, default 4>,
  "category_filter": "<specific category value if mentioned, else null>",
  "region_filter": "<specific region value if mentioned, else null>",
  "dimension": "<'product_category' or 'region' if they ask about which category/region is best/worst, else null>",
  "adjustment_pct": <number if scenario, null otherwise>,
  "direction": "<'spike', 'dip', or 'both' for anomaly questions>",
  "scenario_type": "<'single', 'flat', 'best_worst'>"
}}

Intent rules:
- "forecast" → asking to predict future values of a metric (possibly filtered by category/region)
- "anomaly" → asking about sudden changes, spikes, dips, unusual activity in a metric (possibly filtered)
- "best_dimension" → asking which category or region will perform best / has highest metric
- "anomaly_by_dimension" → asking which category or region has most unusual activity
- "scenario" → "what if X grows/drops by N%" or "what if we keep last month's trend"
- "scenario_best_worst" → asking for best case vs worst case

Scenario type rules:
- "single" → specific percentage given
- "flat" → "keep last month", "same trend", "no change" → adjustment_pct = 0
- "best_worst" → "best case vs worst case", "upside downside"

Direction rules for anomaly:
- "spike" → mentions spike, jump, surge, high, increase unexpectedly
- "dip" → mentions dip, drop, fall, low, decline unexpectedly
- "both" → general anomaly question

Return ONLY the JSON, no explanation, no markdown.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


def explain_forecast(forecast: list, anomalies: list, baseline: list,
                     metric: str = "revenue", filter_label: str = "",
                     intent: str = "both", question: str = ""):

    forecast_text = "\n".join([
        f"{f.get('date_label', 'Week {}'.format(f['period']))}: "
        f"low={f['low']:,.0f}, likely={f['likely']:,.0f}, high={f['high']:,.0f}, "
        f"growth={f.get('growth_pct', 0):+.1f}%"
        for f in forecast
    ])
    anomaly_text = "None detected" if not anomalies else "\n".join([
        f"{a.get('date', 'Point {}'.format(a['index']))} : "
        f"value={a['value']:,.0f}, z={a['z_score']}, {a['direction']}, "
        f"{abs(a['pct_from_mean']):.1f}% from mean"
        for a in anomalies
    ])
    filter_ctx = f" for {filter_label}" if filter_label else ""

    prompt = f"""
You are a plain-English forecasting assistant for business users.
The user asked: "{question}"
Metric: {metric}{filter_ctx}

Forecast:
{forecast_text}

Baseline average: {baseline[0]:,.0f}
Anomalies: {anomaly_text}

Write 3 clear sentences:
1. Direct answer — what the forecast shows and the trend direction
2. Key numbers — the specific values they need to know with dates
3. Action — what to do or watch for

No jargon. Be specific with numbers. Use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=180
    )
    return response.choices[0].message.content


def explain_anomaly(anomalies: list, metric: str, filter_label: str = "",
                    total_points: int = 0, direction: str = "both", question: str = ""):
    filter_ctx = f" for {filter_label}" if filter_label else ""
    if not anomalies:
        return f"No {'spike' if direction == 'spike' else 'dip' if direction == 'dip' else 'anomaly'} detected in {metric}{filter_ctx} — the data looks clean and within expected ranges."

    anom_text = "\n".join([
        f"- {a.get('date', 'Point {}'.format(a['index']))} : "
        f"{a['direction']}, value={a['value']:,.0f} "
        f"({abs(a['pct_from_mean']):.1f}% from mean, z={a['z_score']})"
        for a in anomalies
    ])
    prompt = f"""
You are a business anomaly detection assistant.
User asked: "{question}"
Metric: {metric}{filter_ctx} ({total_points} total data points)

Anomalies found:
{anom_text}

Write 2-3 sentences:
1. Direct answer — yes/no, how many, when
2. What the values show — magnitude, dates
3. What to investigate or do next

Plain English, no jargon, specific with dates and numbers.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


def explain_best_dimension(rankings: list, metric: str, dimension: str, question: str = ""):
    top3 = rankings[:3]
    ranking_text = "\n".join([
        f"{i+1}. {r['value']}: forecasted avg {r['forecasted_weekly_avg']:,.0f}/week, {r['growth_pct']:+.1f}% growth"
        for i, r in enumerate(top3)
    ])
    dim_label = "category" if dimension == "product_category" else "region"
    prompt = f"""
You are a business forecasting assistant.
User asked: "{question}"
Metric: {metric}, ranked by {dim_label}

Rankings (next 4 weeks forecast):
{ranking_text}

Write 2 sentences:
1. Which {dim_label} will perform best and the key numbers
2. One actionable insight — what this means for the business

Plain English, specific, no jargon.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=120
    )
    return response.choices[0].message.content


def explain_anomaly_by_dimension(signals: list, metric: str, dimension: str, question: str = ""):
    dim_label = "category" if dimension == "product_category" else "region"
    signals_text = "\n".join([
        f"- {s['value']}: {s['anomaly_count']} anomalies, {s['growth_pct']:+.1f}% growth, signal={s['signal_label']}"
        for s in signals
    ])
    prompt = f"""
You are a business anomaly detection assistant.
User asked: "{question}"
Metric: {metric}, by {dim_label}

{dim_label.capitalize()} signals:
{signals_text}

Write 2 sentences:
1. Which {dim_label} has the most unusual activity and what's happening
2. What to investigate or do next

Plain English, specific with values and dates, no jargon.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=120
    )
    return response.choices[0].message.content


def explain_scenario(baseline_forecast: list, scenario_forecast: list,
                     adjustment: float, metric: str = "revenue", question: str = ""):
    scenario_type = "flat trend" if adjustment == 0 else f"{adjustment:+.0f}% adjustment"
    baseline_vals = [f['likely'] for f in baseline_forecast]
    scenario_vals = [f['likely'] for f in scenario_forecast]
    prompt = f"""
You are a forecasting assistant. User asked: "{question}"
Metric: {metric}, scenario: {scenario_type}

Baseline forecast (likely values): {[f'{v:,.0f}' for v in baseline_vals]}
Scenario forecast (likely values): {[f'{v:,.0f}' for v in scenario_vals]}

Write 2 sentences:
1. What changes under this scenario vs baseline — be specific with numbers
2. Whether this is better or worse and what to watch

Plain English, specific numbers, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=130
    )
    return response.choices[0].message.content


def explain_scenario_best_worst(best_forecast: list, worst_forecast: list,
                                 baseline_forecast: list, metric: str = "revenue", question: str = ""):
    b_total = sum(f['likely'] for f in best_forecast)
    w_total = sum(f['likely'] for f in worst_forecast)
    base_total = sum(f['likely'] for f in baseline_forecast)
    prompt = f"""
You are a forecasting assistant. User asked: "{question}"
Metric: {metric}

Best case (+20%): total {b_total:,.0f} over {len(best_forecast)} weeks, Week 1: {best_forecast[0]['likely']:,.0f}, Week {len(best_forecast)}: {best_forecast[-1]['likely']:,.0f}
Worst case (-20%): total {w_total:,.0f} over {len(worst_forecast)} weeks, Week 1: {worst_forecast[0]['likely']:,.0f}, Week {len(worst_forecast)}: {worst_forecast[-1]['likely']:,.0f}
Baseline: total {base_total:,.0f}

Gap between best and worst: {b_total - w_total:,.0f}

Write 2 sentences:
1. The best case and worst case numbers — total and weekly range
2. What the gap means for planning — what buffer or reserve to maintain

Plain English, specific numbers, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=130
    )
    return response.choices[0].message.content


def explain_insights(revenue_forecast: list, category_rankings: list, region_signals: list):
    total_growth = revenue_forecast[-1].get("growth_pct", 0) if revenue_forecast else 0
    best_cat = category_rankings[0] if category_rankings else None
    watch_regions = [r for r in region_signals if r["watch"]]
    top_region = watch_regions[0] if watch_regions else (region_signals[0] if region_signals else None)

    cat_text = f"Best category: {best_cat['category']} (£{best_cat['forecasted_weekly_avg']:,.0f}/week, {best_cat['growth_pct']:+.1f}% growth)" if best_cat else "No category data"
    region_text = "\n".join([
        f"Region {r['value']}: {r['signal_label']}, {r['growth_pct']:+.1f}% growth, {r['anomaly_count']} anomalies"
        for r in region_signals
    ]) if region_signals else "No region data"
    revenue_text = "\n".join([
        f"{f.get('date_label', 'Week {}'.format(f['period']))}: "
        f"£{f['likely']:,.0f} (£{f['low']:,.0f}–£{f['high']:,.0f})"
        for f in revenue_forecast
    ])

    prompt = f"""
You are a business forecasting assistant. Write ONE 2-sentence summary.

Total revenue forecast:
{revenue_text}
Overall growth: {total_growth:+.1f}%

{cat_text}
Region signals:
{region_text}

Style: "Revenue is trending +8% over the next 4 weeks, driven by Electronics in the North. Watch the South — an unusual dip has been detected that may signal a demand issue."

Sentence 1: Overall trend + key driver
Sentence 2: What to watch and why

Specific numbers, punchy, no jargon, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=110
    )
    return response.choices[0].message.content
