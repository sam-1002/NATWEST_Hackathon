import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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

Here are the forecast results:
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

    response = client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents=prompt
    )
    return response.text


def explain_scenario(baseline_forecast: list, scenario_forecast: list, adjustment: float):

    prompt = f"""
You are a forecasting assistant. A user tested a scenario with {adjustment:+.0f}% adjustment to their data.

Baseline forecast (next 4 weeks likely values): {[f['likely'] for f in baseline_forecast]}
Scenario forecast (next 4 weeks likely values): {[f['likely'] for f in scenario_forecast]}

Write 2 sentences:
1. What changes under this scenario compared to baseline
2. Whether this scenario looks better or worse and what the user should watch for

Be specific with numbers. Keep it simple.
"""

    response = client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents=prompt
    )
    return response.text