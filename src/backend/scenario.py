import numpy as np
from src.backend.models import run_forecast, detect_anomalies

def run_scenario(values: list, adjustment_pct: float, periods: int = 4):
    
    # baseline forecast on original values
    baseline_result = run_forecast(values, periods)
    baseline_forecast = baseline_result["forecast"]

    # adjust values by percentage
    multiplier = 1 + (adjustment_pct / 100)
    adjusted_values = [round(v * multiplier, 2) for v in values]

    # forecast on adjusted values
    scenario_result = run_forecast(adjusted_values, periods)
    scenario_forecast = scenario_result["forecast"]

    # compute differences
    comparison = []
    for base, scen in zip(baseline_forecast, scenario_forecast):
        diff = round(scen["likely"] - base["likely"], 2)
        diff_pct = round((diff / base["likely"]) * 100, 2)
        comparison.append({
            "period": base["period"],
            "baseline": base["likely"],
            "scenario": scen["likely"],
            "difference": diff,
            "difference_pct": diff_pct
        })

    return {
        "adjustment_pct": adjustment_pct,
        "baseline_forecast": baseline_forecast,
        "scenario_forecast": scenario_forecast,
        "comparison": comparison,
        "model_used": scenario_result["model_used"]
    }