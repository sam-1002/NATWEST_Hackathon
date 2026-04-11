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
    prompt = f"""
You are a forecasting assistant. A user tested a scenario with {adjustment:+.0f}% adjustment.

Baseline forecast (likely values): {[f['likely'] for f in baseline_forecast]}
Scenario forecast (likely values): {[f['likely'] for f in scenario_forecast]}

Write 2 sentences:
1. What changes under this scenario compared to baseline
2. Whether this looks better or worse and what to watch for

Be specific with numbers. Keep it simple.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
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