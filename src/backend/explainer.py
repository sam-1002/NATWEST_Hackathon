import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=os.getenv("GITHUB_TOKEN")
)


def explain_forecast(forecast: list, anomalies: list, baseline: list, intent: str = "both", question: str = ""):

    forecast_text = "\n".join([
        f"Week {f['period']}: low={f['low']}, likely={f['likely']}, high={f['high']}, growth={f.get('growth_pct', 0)}%"
        for f in forecast
    ])

    anomaly_text = "None detected" if not anomalies else "\n".join([
        f"Point {a['index']}: value={a['value']}, z_score={a['z_score']}, direction={a['direction']}, {abs(a['pct_from_mean'])}% from mean"
        for a in anomalies
    ])

    if intent == "anomaly":
        focus = "Focus primarily on answering whether there are sudden changes or anomalies. Lead with a direct yes/no answer to the question, then explain what was found."
    elif intent == "forecast":
        focus = "Focus primarily on the forecast trend and growth numbers."
    else:
        focus = "Cover both anomalies and forecast trend equally."

    prompt = f"""
You are a plain-English forecasting assistant helping business users understand data.

The user asked: "{question}"

Forecast results:
{forecast_text}

Baseline average: {baseline[0]}

Anomalies detected:
{anomaly_text}

{focus}

Write a clear 3-sentence response directly answering their question:
1. Direct answer to what they asked
2. Key numbers they need to know
3. Suggested action if anything needs attention

Keep it simple, specific, and conversational. No technical jargon.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )
    return response.choices[0].message.content


def explain_scenario(baseline_forecast: list, scenario_forecast: list, adjustment: float):
    b_values = [f['likely'] for f in baseline_forecast]
    s_values = [f['likely'] for f in scenario_forecast]
    s_low = [f['low'] for f in scenario_forecast]
    s_high = [f['high'] for f in scenario_forecast]
    
    b_total = sum(b_values)
    s_total = sum(s_values)
    diff = s_total - b_total
    diff_pct = ((s_total - b_total) / b_total * 100) if b_total > 0 else 0
    
    direction = "increase" if adjustment > 0 else "decrease"
    better_worse = "better" if adjustment > 0 else "worse"

    prompt = f"""
You are a forecasting assistant. Write ONE clear sentence exactly like this example:
"Under a +10% traffic scenario, conversions are expected to reach 18,000 (vs 15,900 in baseline). Range: 17,200-19,500."

The user tested a {adjustment:+.0f}% {direction} scenario.

Data:
- Baseline total over {len(b_values)} weeks: {b_total:,.0f} (weekly avg: {b_total/len(b_values):,.0f})
- Scenario total over {len(s_values)} weeks: {s_total:,.0f} (weekly avg: {s_total/len(s_values):,.0f})  
- Difference: {diff:+,.0f} ({diff_pct:+.1f}%)
- Scenario range week 1: {s_low[0]:,.0f} to {s_high[0]:,.0f}
- Scenario range week {len(s_values)}: {s_low[-1]:,.0f} to {s_high[-1]:,.0f}

Write exactly 2 sentences:
1. "Under a {adjustment:+.0f}% scenario, [metric] is expected to reach [scenario weekly avg] (vs [baseline weekly avg] in baseline)."
2. "Range: [lowest low] to [highest high]. This looks {better_worse} than baseline — [one action to take]."

Use actual numbers. No markdown. No asterisks.
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


def explain_insights(
    revenue_forecast: list,
    category_rankings: list,
    region_signals: list
):
    """
    Produces one plain-English summary sentence covering:
    - Total revenue trend
    - Best performing category
    - Region to watch
    Format: "Sales are trending +8% driven by North region. Watch Electronics — demand spike expected in Week 3."
    """
    total_growth = revenue_forecast[-1].get("growth_pct", 0) if revenue_forecast else 0
    best_cat = category_rankings[0] if category_rankings else None
    watch_regions = [r for r in region_signals if r["watch"]]
    top_region = watch_regions[0] if watch_regions else (region_signals[0] if region_signals else None)

    cat_text = f"Best category: {best_cat['category']} (forecasted avg £{best_cat['forecasted_weekly_avg']:,.0f}/week, {best_cat['growth_pct']:+.1f}% growth)" if best_cat else "No category data"
    region_text = "\n".join([
        f"Region {r['region']}: {r['signal_label']}, {r['growth_pct']:+.1f}% growth, {r['anomaly_count']} anomalies"
        for r in region_signals
    ]) if region_signals else "No region data"

    revenue_text = "\n".join([
        f"Week {f['period']}: £{f['likely']:,.0f} (range £{f['low']:,.0f}–£{f['high']:,.0f})"
        for f in revenue_forecast
    ])

    prompt = f"""
You are a business forecasting assistant. Write ONE clear, punchy summary (2 sentences max) for a business user.

Total revenue forecast:
{revenue_text}
Overall growth trend: {total_growth:+.1f}% by week {len(revenue_forecast)}

{cat_text}

Region signals:
{region_text}

Write exactly 2 sentences in this style:
- Sentence 1: Overall revenue trend and the key driver (best category or region)
- Sentence 2: What to watch — the region or category that needs attention and why

Example style: "Revenue is trending +8% over the next 4 weeks, driven by Electronics in the North region. Watch the South — an unusual dip has been detected that may signal a demand issue."

Be specific with numbers. Keep it punchy and actionable. No jargon.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=120
    )
    return response.choices[0].message.content


def parse_user_question(question: str, available_columns: list):
    columns_text = ", ".join(available_columns)
    prompt = f"""
A user asked this question about their data: "{question}"

Available columns in their dataset: {columns_text}

Your job:
1. Identify which column they are asking about
2. Identify how many weeks ahead they want (default 4 if not mentioned)
3. Identify if they want anomaly detection, forecast, or both

Respond in JSON only, no extra text:
{{
    "column": "column_name_here",
    "periods": 4,
    "intent": "forecast" or "anomaly" or "both"
}}

If you cannot identify the column, use the first available column.
"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100
    )
    import json
    text = response.choices[0].message.content
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
