import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def explain_forecast(forecast: list, anomalies: list, baseline: list):
    forecast_text = "\n".join([
        f"Week {f['period']}: low={f['low']}, likely={f['likely']}, high={f['high']}"
        for f in forecast
    ])
    anomaly_text = "None detected" if not anomalies else "\n".join([
        f"Point {a['index']}: value={a['value']}, z_score={a['z_score']}, direction={a['direction']}"
        for a in anomalies
    ])
    baseline_text = f"Baseline average: {baseline[0]}"

    prompt = f"""
You are a plain-English forecasting assistant helping business users understand data.

Forecast results:
{forecast_text}

Baseline comparison:
{baseline_text}

Anomalies detected:
{anomaly_text}

Write a clear 3-sentence summary for a non-technical business user:
1. What the forecast shows and whether it looks positive or concerning
2. How it compares to the simple baseline
3. Any anomalies they should investigate and what action to take

Keep it simple, specific, and actionable. No technical jargon.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content