import os
import json
from openai import OpenAI
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

gpt_client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=os.getenv("GITHUB_TOKEN")
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


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

Keep it simple, specific, and conversational. No technical jargon. No markdown asterisks.
"""
    try:
        response = gpt_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200
        )
        return response.choices[0].message.content
    except Exception:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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
You are a forecasting assistant. Write exactly 2 sentences like this example:
"Under a +10% traffic scenario, conversions are expected to reach 18,000 per week (vs 15,900 in baseline). Range: 17,200 to 19,500 — this looks better than baseline, consider increasing marketing spend to capitalize."

The user tested a {adjustment:+.0f}% {direction} scenario.

Data:
- Baseline weekly avg: {b_total/len(b_values):,.0f}
- Scenario weekly avg: {s_total/len(s_values):,.0f}
- Difference: {diff:+,.0f} ({diff_pct:+.1f}%)
- Scenario week 1 range: {s_low[0]:,.0f} to {s_high[0]:,.0f}
- Scenario week {len(s_values)} range: {s_low[-1]:,.0f} to {s_high[-1]:,.0f}

Write exactly 2 sentences. Use actual numbers. No markdown. No asterisks.
"""
    try:
        response = gpt_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        )
        return response.choices[0].message.content
    except Exception:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        )
        return response.choices[0].message.content


def explain_insights(revenue_forecast: list, category_rankings: list, region_signals: list):
    total_growth = revenue_forecast[-1].get("growth_pct", 0) if revenue_forecast else 0
    best_cat = category_rankings[0] if category_rankings else None
    cat_text = f"Best category: {best_cat['category']} (£{best_cat['forecasted_weekly_avg']:,.0f}/week, {best_cat['growth_pct']:+.1f}% growth)" if best_cat else "No category data"
    region_text = "\n".join([
        f"Region {r['region']}: {r['signal_label']}, {r['growth_pct']:+.1f}% growth, {r['anomaly_count']} anomalies"
        for r in region_signals
    ]) if region_signals else "No region data"
    revenue_text = "\n".join([
        f"Week {f['period']}: {f['likely']:,.0f} (range {f['low']:,.0f} to {f['high']:,.0f})"
        for f in revenue_forecast
    ])

    prompt = f"""
You are a business forecasting assistant. Write exactly 2 punchy sentences for a business user.

Revenue forecast:
{revenue_text}
Overall growth: {total_growth:+.1f}% by week {len(revenue_forecast)}

{cat_text}

Region signals:
{region_text}

Sentence 1: Overall trend and key driver.
Sentence 2: What to watch and why.

No markdown. No asterisks. Be specific with numbers.
"""
    try:
        response = gpt_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120
        )
        return response.choices[0].message.content
    except Exception:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120
        )
        return response.choices[0].message.content


def parse_user_question(question: str, available_columns: list, schema: dict = None):
    numeric_cols = available_columns
    categorical_info = ""
    if schema:
        categorical_info = "\n".join([
            f"- '{col}' has values: {', '.join(str(v) for v in vals[:15])}"
            for col, vals in schema.get("categorical_cols", {}).items()
        ])

    prompt = f"""Extract information from this user question about data forecasting.

User question: "{question}"

Available numeric columns (can be forecasted): {', '.join(numeric_cols)}

Available categorical columns and their values:
{categorical_info if categorical_info else "None"}

Return ONLY a JSON object with no extra text, no markdown, no explanation:
{{"column": "exact_column_name", "periods": 4, "intent": "forecast", "filters": {{"col_name": "value"}}}}

Rules:
- column: pick the closest matching name from available numeric columns
- periods: extract number of weeks from question, default 4
- intent: "forecast" if asking about future, "anomaly" if asking about spikes/dips/unusual
- filters: only add if user mentioned specific category/region values, otherwise use {{}}
- Match filter values exactly to the available values listed above"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.1
    )
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    start = text.find('{')
    end = text.rfind('}') + 1
    if start != -1 and end > start:
        text = text[start:end]
    return json.loads(text)