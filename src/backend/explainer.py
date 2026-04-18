"""
explainer.py  —  LLM-powered plain-English explanations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Three gaps fixed vs the original:

1. FORECAST — now passes trend direction, seasonality label, and model name
   so the LLM can say "seasonal spike expected in Week 3" instead of just
   restating the numbers.

2. ANOMALY — now passes forecast bands per anomaly point so the LLM can say
   "this value is outside the normal forecast range". Also passes severity and
   a domain-context block so it can suggest likely causes.

3. SCENARIO — now passes full low/likely/high ranges (not just likely values)
   and explicit totals so the LLM can produce the side-by-side comparison
   format with ranges that the problem statement requires.
"""

import os
import json
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=os.getenv("GITHUB_TOKEN")
)


# ══════════════════════════════════════════════════════════════════════════════
# QUERY PARSER  — unchanged from original
# ══════════════════════════════════════════════════════════════════════════════

def parse_user_question(question: str, schema: dict) -> dict:
    """
    Parses user question into a structured intent object.
    schema = {
        "numeric_cols": ["revenue", "units_sold", "profit"],
        "categorical_cols": {"product_category": ["Electronics", ...], "region": ["North", ...]}
    }
    """
    numeric_cols = schema.get("numeric_cols", [])
    categorical_cols = schema.get("categorical_cols", {})

    prompt = f"""
You are a query parser for a business forecasting app.

User question: "{question}"

Available data schema:
- Numeric columns (metrics): {numeric_cols}
- Categorical columns: {json.dumps({k: list(v) for k, v in categorical_cols.items()})}

Parse the question and return ONLY a JSON object with these fields:

{{
  "intent": "<one of: forecast, anomaly, best_dimension, anomaly_by_dimension, scenario, scenario_best_worst, driver_analysis, impact_simulation, lead_indicator, multivariate_forecast>",
  "metric": "<which numeric column they want as TARGET, default to first one if unclear>",
  "driver_metric": "<second numeric column they mention as a DRIVER/CAUSE, else null>",
  "periods": <integer weeks ahead, default 4>,
  "category_filter": "<specific category value if mentioned, else null>",
  "region_filter": "<specific region value if mentioned, else null>",
  "dimension": "<'product_category' or 'region' if they ask about which category/region is best/worst, else null>",
  "adjustment_pct": <number if scenario or impact_simulation, null otherwise>,
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
- "driver_analysis" → asking what drives or influences a metric, what factors impact it, what causes changes in it. Keywords: driving, driven by, factors, influences, causes, impacts, affects
- "impact_simulation" → asking the effect of a change in ONE metric on ANOTHER metric. Keywords: effect of, impact of, if X increases/decreases by N%, what happens to Y if X changes
- "lead_indicator" → asking if one metric predicts another in advance. Keywords: predict in advance, leading indicator, does X predict Y, does X move before Y, early signal
- "multivariate_forecast" → asking to forecast a metric USING another metric as input. Keywords: forecast X using Y, predict X factoring in Y, forecast X with Y

Scenario type rules:
- "single" → specific percentage given
- "flat" → "keep last month", "same trend", "no change" → adjustment_pct = 0
- "best_worst" → "best case vs worst case", "upside downside"

Direction rules for anomaly:
- "spike" → mentions spike, jump, surge, high, increase unexpectedly
- "dip" → mentions dip, drop, fall, low, decline unexpectedly
- "both" → general anomaly question

For multivariate intents (driver_analysis, impact_simulation, lead_indicator, multivariate_forecast):
- "metric" = the TARGET column (what they want to understand or forecast)
- "driver_metric" = the INPUT/DRIVER column (what they think causes or predicts the target)
- If only one column is mentioned for driver_analysis, set driver_metric to null

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


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — compute trend/seasonality labels locally before calling LLM
# ══════════════════════════════════════════════════════════════════════════════

def _trend_label(forecast: list) -> str:
    """Derive a plain-English trend label from the forecast list."""
    if len(forecast) < 2:
        return "stable"
    first = forecast[0]["likely"]
    last  = forecast[-1]["likely"]
    if first == 0:
        return "stable"
    change = ((last - first) / abs(first)) * 100
    if change > 5:
        return f"upward (+{change:.1f}% over the forecast window)"
    if change < -5:
        return f"downward ({change:.1f}% over the forecast window)"
    return "broadly flat"


def _seasonality_label(seasonality_period) -> str:
    """Convert numeric period to a readable label."""
    if seasonality_period == 7:
        return "weekly seasonality detected"
    if seasonality_period == 12:
        return "monthly/annual seasonality detected"
    if seasonality_period:
        return f"seasonality detected (period={seasonality_period})"
    return "no significant seasonality"


def _peak_week(forecast: list) -> str:
    """Return the date label of the highest forecast period."""
    if not forecast:
        return "unknown"
    peak = max(forecast, key=lambda f: f["likely"])
    return peak.get("date_label", f"Week {peak['period']}")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 — FORECAST EXPLAINER
# Now includes: trend direction, seasonality label, model used, peak period
# ══════════════════════════════════════════════════════════════════════════════

def explain_forecast(forecast: list, anomalies: list, baseline: list,
                     metric: str = "revenue", filter_label: str = "",
                     intent: str = "both", question: str = "",
                     model_used: str = "", seasonality_period=None):
    """
    FIX: passes trend direction, seasonality label, model name, and peak period
    so the LLM can address all three PS requirements:
      - Predict likely values (already done)
      - Show range of outcomes (low/high passed)
      - Highlight key patterns: trend + seasonality (NOW ADDED)
    """
    filter_ctx = f" for {filter_label}" if filter_label else ""

    # --- compute pattern context locally (no LLM needed) ---
    trend = _trend_label(forecast)
    season_label = _seasonality_label(seasonality_period)
    peak = _peak_week(forecast)
    baseline_avg = baseline[0] if baseline else 0

    forecast_text = "\n".join([
        f"  {f.get('date_label', 'Week ' + str(f['period']))}: "
        f"low={f['low']:,.0f}, likely={f['likely']:,.0f}, high={f['high']:,.0f}, "
        f"growth vs last={f.get('growth_pct', 0):+.1f}%"
        for f in forecast
    ])

    anomaly_ctx = ""
    if anomalies:
        anomaly_ctx = "Historical anomalies in this series:\n" + "\n".join([
            f"  {a.get('date', 'Point ' + str(a['index']))}: "
            f"{a['direction']}, {abs(a['pct_from_mean']):.1f}% from mean"
            for a in anomalies
        ])

    prompt = f"""
You are a plain-English forecasting assistant for business users.
User asked: "{question}"
Metric: {metric}{filter_ctx}

PATTERN ANALYSIS (use this in your answer):
- Trend: {trend}
- Seasonality: {season_label}
- Highest forecast period: {peak}
- Model used: {model_used or 'statistical model'}
- Baseline average (last 4 periods): {baseline_avg:,.0f}

FORECAST (low / likely / high):
{forecast_text}

{anomaly_ctx}

Write exactly 3 sentences:
1. Trend sentence — state the overall direction and mention seasonality if present
   e.g. "Revenue is trending upward +8% with a seasonal spike expected in Week 3."
2. Numbers sentence — give the specific likely values and the low-to-high range
   e.g. "The likely total over 4 weeks is £X (range £Y–£Z), peaking at £W on [date]."
3. Action sentence — what to watch or do next based on the trend and any anomalies

Rules: no jargon, use £ for monetary values, be specific with dates and numbers.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# FIX 2 — ANOMALY EXPLAINER
# Now includes: forecast band comparison, severity, likely causes context
# ══════════════════════════════════════════════════════════════════════════════

def explain_anomaly(anomalies: list, metric: str, filter_label: str = "",
                    total_points: int = 0, direction: str = "both",
                    question: str = "", forecast_bands: list = None):
    """
    FIX: now passes forecast bands so LLM can say "outside normal forecast range".
    Also adds severity and a domain-context block for likely causes.
    Addresses all three PS anomaly requirements:
      - Flag spikes/dips (already done)
      - Show whether movement is outside forecast range (NOW ADDED)
      - Provide explanations and likely causes (NOW ADDED)
      - Suggest next steps (NOW ADDED with domain-specific suggestions)
    """
    filter_ctx = f" for {filter_label}" if filter_label else ""

    if not anomalies:
        direction_word = (
            "spike" if direction == "spike"
            else "dip" if direction == "dip"
            else "anomaly"
        )
        return (
            f"No {direction_word} detected in {metric}{filter_ctx} — "
            f"the data looks clean and within expected ranges."
        )

    # Build anomaly text with band comparison
    anom_lines = []
    for a in anomalies:
        date_str   = a.get("date", f"Point {a['index']}")
        severity   = a.get("severity", "moderate")
        band_note  = ""

        # Check if this anomaly index has a forecast band to compare against
        if forecast_bands:
            idx = a["index"]
            if idx < len(forecast_bands):
                band = forecast_bands[idx]
                if a["value"] < band["low"]:
                    band_note = f" — BELOW forecast range ({band['low']:,.0f}–{band['high']:,.0f})"
                elif a["value"] > band["high"]:
                    band_note = f" — ABOVE forecast range ({band['low']:,.0f}–{band['high']:,.0f})"
                else:
                    band_note = f" — within forecast range ({band['low']:,.0f}–{band['high']:,.0f})"

        anom_lines.append(
            f"  {date_str}: {a['direction'].upper()} ({severity}), "
            f"value={a['value']:,.0f} "
            f"({abs(a['pct_from_mean']):.1f}% {'above' if a['z_score'] > 0 else 'below'} mean, "
            f"z={a['z_score']}){band_note}"
        )

    anom_text = "\n".join(anom_lines)

    # Domain-context block — gives LLM something to reason about for causes
    likely_causes = {
        "spike": [
            "promotional event or marketing campaign",
            "bulk order or one-off large transaction",
            "data entry error (duplicate records)",
            "seasonal demand surge",
        ],
        "dip": [
            "supply or stock issue",
            "system outage or data pipeline failure",
            "lost key customer or contract",
            "holiday or bank holiday effect",
        ],
        "both": [
            "seasonal effects",
            "one-off events (promotions, outages, bulk orders)",
            "data pipeline errors",
            "external market changes",
        ]
    }
    causes_text = ", ".join(likely_causes.get(direction, likely_causes["both"]))

    next_steps = {
        "spike": "check for duplicate records or bulk orders; if genuine, investigate whether the surge is sustainable",
        "dip":   "check system logs and data pipelines for errors; if genuine, escalate to operations or supply chain",
        "both":  "review the affected dates in source systems and check for data errors before drawing conclusions",
    }
    step_text = next_steps.get(direction, next_steps["both"])

    prompt = f"""
You are a business anomaly detection assistant.
User asked: "{question}"
Metric: {metric}{filter_ctx} ({total_points} total data points analysed)

ANOMALIES FOUND:
{anom_text}

CONTEXT FOR YOUR ANSWER:
- Likely causes to consider: {causes_text}
- Suggested next step: {step_text}

Write exactly 3 sentences:
1. Direct answer — how many anomalies, when, and whether they are inside or outside
   the normal forecast range (use the band notes above)
   e.g. "3 unusual spikes detected on [dates], two of which exceeded the upper forecast band."
2. Magnitude sentence — the specific values and how far they deviate from normal
   e.g. "The largest spike on [date] reached £X, which is Y% above the expected range."
3. Action sentence — likely cause and what to investigate next
   e.g. "This may indicate a bulk order or data error — check source records for [date]."

Rules: plain English, no jargon, specific with dates and numbers, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=180
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# FIX 3 — SCENARIO EXPLAINER (single adjustment)
# Now includes: full low/likely/high ranges, totals, side-by-side comparison
# ══════════════════════════════════════════════════════════════════════════════

def explain_scenario(baseline_forecast: list, scenario_forecast: list,
                     adjustment: float, metric: str = "revenue", question: str = ""):
    """
    FIX: passes full low/likely/high ranges (not just likely values) and
    per-period side-by-side comparison so the LLM can produce the PS example:
      "Under a +10% scenario, X expected to reach 18,000 (vs 15,900 baseline).
       Range: 17,200–19,500."
    """
    scenario_type = "flat trend (no change)" if adjustment == 0 else f"{adjustment:+.0f}% adjustment"

    # Build side-by-side comparison rows with ranges
    comparison_rows = []
    for base, scen in zip(baseline_forecast, scenario_forecast):
        period = base.get("date_label", f"Week {base['period']}")
        diff   = scen["likely"] - base["likely"]
        comparison_rows.append(
            f"  {period}: baseline {base['likely']:,.0f} (range {base['low']:,.0f}–{base['high']:,.0f})  →  "
            f"scenario {scen['likely']:,.0f} (range {scen['low']:,.0f}–{scen['high']:,.0f})  "
            f"[diff {diff:+,.0f}]"
        )
    comparison_text = "\n".join(comparison_rows)

    # Totals
    base_total   = sum(f["likely"] for f in baseline_forecast)
    scen_total   = sum(f["likely"] for f in scenario_forecast)
    scen_low     = sum(f["low"]    for f in scenario_forecast)
    scen_high    = sum(f["high"]   for f in scenario_forecast)
    total_diff   = scen_total - base_total
    total_diff_pct = (total_diff / base_total * 100) if base_total else 0

    prompt = f"""
You are a forecasting assistant. User asked: "{question}"
Metric: {metric}, scenario: {scenario_type}

SIDE-BY-SIDE COMPARISON (baseline → scenario, with ranges):
{comparison_text}

TOTALS over {len(baseline_forecast)} weeks:
  Baseline total: {base_total:,.0f}
  Scenario total: {scen_total:,.0f} (range {scen_low:,.0f}–{scen_high:,.0f})
  Total difference: {total_diff:+,.0f} ({total_diff_pct:+.1f}%)

Write exactly 2 sentences following this style:
1. "Under a [scenario], [metric] is expected to reach [scenario total] over [N] weeks
    (vs [baseline total] baseline). Range: [low]–[high]."
2. "The biggest difference appears in [week with largest gap] — [brief implication for planning]."

Rules: match the style exactly, use £ for monetary values, be specific with all numbers.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=160
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# FIX 3b — SCENARIO BEST/WORST EXPLAINER
# Now includes ranges per week and planning buffer guidance
# ══════════════════════════════════════════════════════════════════════════════

def explain_scenario_best_worst(best_forecast: list, worst_forecast: list,
                                 baseline_forecast: list,
                                 metric: str = "revenue", question: str = ""):
    """
    FIX: passes week-by-week ranges for all three scenarios so the LLM
    can produce a genuine side-by-side comparison with ranges.
    """
    b_total    = sum(f["likely"] for f in best_forecast)
    w_total    = sum(f["likely"] for f in worst_forecast)
    base_total = sum(f["likely"] for f in baseline_forecast)

    b_low  = sum(f["low"]  for f in best_forecast)
    b_high = sum(f["high"] for f in best_forecast)
    w_low  = sum(f["low"]  for f in worst_forecast)
    w_high = sum(f["high"] for f in worst_forecast)

    # Week-by-week rows
    rows = []
    for i, (best, worst, base) in enumerate(zip(best_forecast, worst_forecast, baseline_forecast)):
        period = best.get("date_label", f"Week {i+1}")
        rows.append(
            f"  {period}: worst {worst['likely']:,.0f} ({worst['low']:,.0f}–{worst['high']:,.0f})  |  "
            f"base {base['likely']:,.0f}  |  "
            f"best {best['likely']:,.0f} ({best['low']:,.0f}–{best['high']:,.0f})"
        )
    weekly_table = "\n".join(rows)

    gap = b_total - w_total

    prompt = f"""
You are a forecasting assistant. User asked: "{question}"
Metric: {metric}

WEEKLY COMPARISON (worst | baseline | best):
{weekly_table}

TOTALS over {len(baseline_forecast)} weeks:
  Best case (+20%):  {b_total:,.0f} (range {b_low:,.0f}–{b_high:,.0f})
  Baseline:          {base_total:,.0f}
  Worst case (-20%): {w_total:,.0f} (range {w_low:,.0f}–{w_high:,.0f})
  Gap (best vs worst): {gap:,.0f}

Write exactly 2 sentences following this style:
1. "Best case totals £[X] over [N] weeks (range £[low]–£[high]);
    worst case totals £[Y] (range £[low]–£[high]) — a gap of £[Z]."
2. "To manage this uncertainty, plan for a buffer of at least £[gap/4 per week]
    per week — [one specific planning action based on the direction of risk]."

Rules: use £ for monetary values, be specific with all numbers.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=160
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# DIMENSION EXPLAINERS — unchanged in logic, minor prompt tightening
# ══════════════════════════════════════════════════════════════════════════════

def explain_best_dimension(rankings: list, metric: str, dimension: str, question: str = ""):
    top3 = rankings[:3]
    ranking_text = "\n".join([
        f"  {i+1}. {r['value']}: avg {r['forecasted_weekly_avg']:,.0f}/week, "
        f"{r['growth_pct']:+.1f}% growth, range "
        f"{min(f['low'] for f in r.get('forecast', [{'low': 0}])):,.0f}–"
        f"{max(f['high'] for f in r.get('forecast', [{'high': 0}])):,.0f}"
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
1. Which {dim_label} will perform best, with the average weekly value and growth rate
2. One actionable insight — what this means for the business and where to focus

Plain English, specific numbers, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=130
    )
    return response.choices[0].message.content


def explain_anomaly_by_dimension(signals: list, metric: str, dimension: str, question: str = ""):
    dim_label = "category" if dimension == "product_category" else "region"
    signals_text = "\n".join([
        f"  {s['value']}: {s['anomaly_count']} anomalies, "
        f"{s['growth_pct']:+.1f}% recent growth, signal={s['signal_label']}"
        for s in signals
    ])
    prompt = f"""
You are a business anomaly detection assistant.
User asked: "{question}"
Metric: {metric}, by {dim_label}

{dim_label.capitalize()} signals:
{signals_text}

Write 2 sentences:
1. Which {dim_label} has the most unusual activity, how many anomalies, and the signal type
2. What to investigate — be specific about which {dim_label} to look at and why

Plain English, specific with values, no jargon.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=130
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS EXPLAINER — unchanged
# ══════════════════════════════════════════════════════════════════════════════

def explain_insights(revenue_forecast: list, category_rankings: list, region_signals: list):
    total_growth = revenue_forecast[-1].get("growth_pct", 0) if revenue_forecast else 0
    best_cat     = category_rankings[0] if category_rankings else None
    watch_regions = [r for r in region_signals if r["watch"]]

    cat_text = (
        f"Best category: {best_cat['category']} "
        f"(£{best_cat['forecasted_weekly_avg']:,.0f}/week, {best_cat['growth_pct']:+.1f}% growth)"
        if best_cat else "No category data"
    )
    region_text = "\n".join([
        f"  Region {r.get('region', r.get('value', 'Unknown'))}: {r['signal_label']}, {r['growth_pct']:+.1f}% growth, "
        f"{r['anomaly_count']} anomalies"
        for r in region_signals
    ]) if region_signals else "No region data"
    revenue_text = "\n".join([
        f"  {f.get('date_label', 'Week ' + str(f['period']))}: "
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

Style example:
"Revenue is trending +8% over the next 4 weeks, driven by Electronics in the North.
Watch the South — an unusual dip has been detected that may signal a demand issue."

Sentence 1: Overall trend + key driver category
Sentence 2: Which region to watch and why

Specific numbers, punchy, no jargon, use £ for monetary values.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=120
    )
    return response.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# MULTIVARIATE EXPLAINERS — Q10, Q11, Q12, Q13
# All pre-compute stats in Python; only send summaries to LLM.
# ══════════════════════════════════════════════════════════════════════════════

def explain_driver_analysis(result: dict, question: str = "") -> str:
    """
    Q10 — Explains which columns most influence the target metric.
    Pre-computed correlations passed in; LLM only writes the plain-English summary.
    """
    if result.get("error") or not result.get("drivers"):
        return f"Could not identify drivers: {result.get('error', 'No significant correlations found.')}."

    target = result["target"]
    top = result["drivers"][:3]

    driver_lines = "\n".join([
        f"  {i+1}. {d['column']}: {d['strength']} {d['direction']} relationship (r={d['correlation']:+.2f})"
        for i, d in enumerate(top)
    ])

    prompt = f"""
You are a business analytics assistant.
User asked: "{question}"
Target metric: {target}

TOP DRIVERS (pre-computed Pearson correlations):
{driver_lines}

Write exactly 2 sentences:
1. Name the top 1-2 drivers, their direction (positive/negative), and correlation strength.
   e.g. "The strongest driver of revenue is marketing_spend (strong positive, r=+0.81), followed by new_customers (moderate positive, r=+0.54)."
2. One actionable business insight — what this relationship means and what to do.
   e.g. "Every increase in marketing_spend is closely followed by a revenue uplift, suggesting marketing investment is yielding returns."

Rules: plain English, specific with column names and r-values, no jargon, no hedging.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


def explain_impact_simulation(result: dict, question: str = "") -> str:
    """
    Q11 — Explains the projected effect of a % change in driver on target.
    All numbers pre-computed via OLS; LLM writes the plain-English output.
    """
    if result.get("error"):
        return f"Could not simulate impact: {result['error']}."

    prompt = f"""
You are a business forecasting assistant.
User asked: "{question}"

IMPACT SIMULATION RESULTS (pre-computed via OLS regression):
- Driver metric: {result['driver_metric']} (current avg: {result['current_driver_avg']:,.2f})
- Target metric: {result['target_metric']} (current avg: {result['current_target_avg']:,.2f})
- Scenario: {result['change_pct']:+.0f}% change in {result['driver_metric']}
- Regression slope: {result['slope']:.4f} (correlation r={result['correlation']:+.2f})
- Projected {result['target_metric']}: {result['projected_target']:,.2f}
- Projected change: {result['projected_change']:+,.2f} ({result['projected_change_pct']:+.1f}%)

Write exactly 2 sentences following this style:
1. "A [N]% [increase/decrease] in [driver] is associated with a [X]% [increase/decrease] in [target], pushing it from [current] to [projected]."
2. One planning implication — what this means and what action to take.

Rules: plain English, specific numbers, use £ for monetary metrics, no jargon.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


def explain_lead_indicator(result: dict, question: str = "") -> str:
    """
    Q12 — Explains whether metric A predicts metric B in advance.
    Cross-correlation and optional Granger results pre-computed; LLM writes the output.
    """
    if result.get("error"):
        return f"Could not run lead indicator test: {result['error']}."

    granger_note = ""
    if result.get("granger_significant"):
        g = result["granger_detail"]
        granger_note = f"Granger causality test confirms this at lag {g['lag']} (p={g['p_value']})."
    elif result.get("granger_significant") is False:
        granger_note = "Granger causality test did not find statistical significance."

    lag_lines = "\n".join([
        f"  Lag {r['lag_weeks']} week(s): correlation={r['correlation']:+.3f}"
        for r in result.get("lag_results", [])
    ])

    prompt = f"""
You are a business analytics assistant.
User asked: "{question}"

LEAD INDICATOR TEST RESULTS:
- Column A (potential predictor): {result['col_a']}
- Column B (target): {result['col_b']}
- Is A a leading indicator of B? {'YES' if result['is_leading_indicator'] else 'NO'}
- Best predictive lag: {result['best_lag_weeks']} week(s) ahead
- Best correlation at that lag: {result['best_correlation']:+.3f} ({result['strength']})
- Direction: {result['direction']}
{granger_note}

Lag breakdown:
{lag_lines}

Write exactly 2 sentences:
1. Direct answer — does {result['col_a']} predict {result['col_b']} in advance, by how many weeks, and how strongly.
   e.g. "Yes — marketing_spend is a moderate positive leading indicator for revenue, predicting it 2 weeks ahead (r=+0.61)."
2. Practical implication — what to monitor and when to act.
   e.g. "Watch marketing_spend levels now — a rise this week is likely to show up as higher revenue in 2 weeks."

Rules: plain English, specific numbers, no jargon, decisive answer.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


def explain_multivariate_forecast(result: dict, question: str = "") -> str:
    """
    Q13 — Explains a VAR-based multivariate forecast.
    Forecast values and model info pre-computed; LLM writes the plain-English output.
    """
    if result.get("error"):
        return f"Could not run multivariate forecast: {result['error']}."

    forecast = result["forecast"]
    target = result["target_metric"]
    drivers = result["driver_metrics"]
    model = result["model_used"]

    forecast_lines = "\n".join([
        f"  {f.get('date_label', 'Week ' + str(f['period']))}: "
        f"low={f['low']:,.0f}, likely={f['likely']:,.0f}, high={f['high']:,.0f}, "
        f"growth={f.get('growth_pct', 0):+.1f}%"
        for f in forecast
    ])

    corr_lines = "\n".join([
        f"  {c['driver']}: correlation with {target} = {c['correlation']:+.3f}"
        for c in result.get("correlation_context", [])
    ])

    total_likely = sum(f["likely"] for f in forecast)
    total_low = sum(f["low"] for f in forecast)
    total_high = sum(f["high"] for f in forecast)
    var_note = "VAR model used — forecast informed by driver trends." if result.get("var_used") else "Univariate fallback used — driver correlation noted but not incorporated into forecast."

    prompt = f"""
You are a business forecasting assistant.
User asked: "{question}"
Target metric: {target}
Driver metrics used: {', '.join(drivers)}
Model: {model} ({var_note})

DRIVER CORRELATIONS:
{corr_lines}

MULTIVARIATE FORECAST (low / likely / high):
{forecast_lines}

TOTAL over {len(forecast)} weeks: {total_likely:,.0f} (range {total_low:,.0f}–{total_high:,.0f})

Write exactly 3 sentences:
1. Trend sentence — overall direction of the forecast and which driver is influencing it most.
   e.g. "Factoring in marketing_spend trends, revenue is forecast to grow +6% over the next 4 weeks."
2. Numbers sentence — total likely value and the range.
   e.g. "The likely total over 4 weeks is £X (range £Y–£Z), peaking on [date]."
3. Action sentence — what the driver relationship means for planning.
   e.g. "Since marketing_spend strongly drives revenue (r=+0.78), maintaining or increasing spend is key to hitting the upper forecast."

Rules: plain English, specific numbers, use £ for monetary metrics, no jargon.
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )
    return response.choices[0].message.content