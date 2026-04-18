from fastapi import Form, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.backend.models import (
    run_forecast, detect_anomalies, attach_forecast_dates,
    forecast_filtered, anomalies_filtered,
    best_by_dimension, most_anomalous_dimension,
    forecast_by_category, analyze_regions,
    driver_analysis, impact_simulation, lead_indicator_test, multivariate_forecast
)
from src.backend.scenario import run_scenario
from src.backend.explainer import (
    parse_user_question, explain_forecast, explain_anomaly,
    explain_best_dimension, explain_anomaly_by_dimension,
    explain_scenario, explain_scenario_best_worst, explain_insights,
    explain_driver_analysis, explain_impact_simulation,
    explain_lead_indicator, explain_multivariate_forecast
)
import pandas as pd
import io
from datetime import timedelta

app = FastAPI(title="Forecasting Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "message": "Forecasting API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def compute_confidence(values, forecast_result):
    n = len(values)
    mean = sum(values) / n if n > 0 else 1
    std = (sum((v - mean) ** 2 for v in values) / n) ** 0.5
    cv = std / abs(mean) if mean != 0 else 1
    length_score = min(40, (n / 52) * 40)
    volatility_score = max(0, 40 * (1 - min(cv, 1)))
    seasonality_score = 20 if forecast_result.get("seasonality_period") else 0
    total = max(10, min(99, round(length_score + volatility_score + seasonality_score)))
    label = "High" if total >= 75 else "Moderate" if total >= 50 else "Low"
    return {"score": total, "label": label}


def generate_forecast_dates(last_date, periods):
    return [(last_date + timedelta(weeks=i + 1)).strftime("%b %d") for i in range(periods)]


def read_and_validate(file: UploadFile, contents: bytes) -> pd.DataFrame:
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file only.")
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file.")
    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df


def get_schema(df: pd.DataFrame) -> dict:
    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = {}
    for c in df.columns:
        if c != "date" and not pd.api.types.is_numeric_dtype(df[c]):
            categorical_cols[c] = sorted(df[c].dropna().unique().tolist())
    return {"numeric_cols": numeric_cols, "categorical_cols": categorical_cols}


def make_preview(df: pd.DataFrame) -> list:
    preview_cols = ["date"] + [c for c in ["product_category", "region", "revenue", "profit", "units_sold"] if c in df.columns]
    rows = df[preview_cols].head(5).copy()
    rows["date"] = rows["date"].dt.strftime("%Y-%m-%d")
    return rows.to_dict(orient="records")


# ── /schema ──────────────────────────────────────────────────────────────────

@app.post("/schema")
async def schema_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    df = read_and_validate(file, contents)
    return {"schema": get_schema(df)}


# ── /forecast ────────────────────────────────────────────────────────────────

@app.post("/forecast")
async def forecast(file: UploadFile = File(...), periods: int = 4, column: str = "value"):
    contents = await file.read()
    df = read_and_validate(file, contents)

    numeric_cols = get_schema(df)["numeric_cols"]
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found.")
    if len(df) < 10:
        raise HTTPException(status_code=400, detail=f"Only {len(df)} rows — need at least 10.")
    if column not in df.columns:
        column = numeric_cols[0]

    # Aggregate if multi-dim
    if "product_category" in df.columns or "region" in df.columns:
        agg = df.groupby("date")[column].sum().reset_index()
    else:
        agg = df[["date", column]].copy()

    values = agg[column].tolist()
    dates = [d.date() for d in agg["date"]]
    last_date = agg["date"].max()

    forecast_result = run_forecast(values, periods)
    attach_forecast_dates(forecast_result["forecast"], last_date)
    anomalies = detect_anomalies(values, dates)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(values, forecast_result)

    preview_rows = agg[["date", column]].head(5).copy()
    preview_rows["date"] = preview_rows["date"].dt.strftime("%Y-%m-%d")
    preview = preview_rows.rename(columns={column: "value"}).to_dict(orient="records")

    ai_summary = explain_forecast(
        forecast_result["forecast"], anomalies, baseline,
        metric=column, question=f"Forecast {column}",
        model_used=forecast_result["model_used"],
        seasonality_period=forecast_result["seasonality_period"]
    )

    return {
        "forecast": forecast_result["forecast"],
        "model_used": forecast_result["model_used"],
        "seasonality_period": forecast_result["seasonality_period"],
        "anomalies": anomalies,
        "baseline": baseline,
        "ai_summary": ai_summary,
        "confidence": confidence,
        "numeric_columns": numeric_cols,
        "selected_column": column,
        "row_count": len(df),
        "preview": preview,
        "historical": [{"date": str(dates[i]), "value": round(v, 2)} for i, v in enumerate(values)]
    }


# ── /insights ────────────────────────────────────────────────────────────────

@app.post("/insights")
async def insights(file: UploadFile = File(...), periods: int = 4):
    contents = await file.read()
    df = read_and_validate(file, contents)

    if "revenue" not in df.columns:
        raise HTTPException(status_code=400, detail="Missing 'revenue' column.")
    if len(df) < 10:
        raise HTTPException(status_code=400, detail=f"Only {len(df)} rows — need at least 10.")

    total_rev = df.groupby("date")["revenue"].sum().reset_index()
    values = total_rev["revenue"].tolist()
    dates = [d.date() for d in total_rev["date"]]
    last_date = total_rev["date"].max()

    forecast_result = run_forecast(values, periods)
    attach_forecast_dates(forecast_result["forecast"], last_date)
    revenue_anomalies = detect_anomalies(values, dates)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(values, forecast_result)

    revenue_historical = [{"date": str(dates[i]), "value": round(v, 2)} for i, v in enumerate(values)]
    category_rankings = forecast_by_category(df, periods)
    region_signals = analyze_regions(df)

    schema = get_schema(df)

    # Rename region signals 'value' field for dashboard compat
    for r in region_signals:
        if "value" in r and "region" not in r:
            r["region"] = r["value"]
        if "recent_avg" in r and "recent_avg_revenue" not in r:
            r["recent_avg_revenue"] = r["recent_avg"]

    ai_summary = explain_insights(forecast_result["forecast"], category_rankings, region_signals)

    return {
        "revenue_forecast": forecast_result["forecast"],
        "revenue_historical": revenue_historical,
        "revenue_anomalies": revenue_anomalies,
        "model_used": forecast_result["model_used"],
        "seasonality_period": forecast_result["seasonality_period"],
        "baseline": baseline,
        "confidence": confidence,
        "category_rankings": category_rankings,
        "region_signals": region_signals,
        "ai_summary": ai_summary,
        "row_count": len(df),
        "preview": make_preview(df),
        "periods": periods,
        "has_categories": "product_category" in df.columns,
        "has_regions": "region" in df.columns,
        "categories": df["product_category"].unique().tolist() if "product_category" in df.columns else [],
        "regions": df["region"].unique().tolist() if "region" in df.columns else [],
        "schema": schema
    }


# ── /scenario ────────────────────────────────────────────────────────────────

@app.post("/scenario")
async def scenario(
    file: UploadFile = File(...),
    adjustment_pct: float = 10.0,
    periods: int = 4,
    column: str = "revenue"
):
    contents = await file.read()
    df = read_and_validate(file, contents)
    numeric_cols = get_schema(df)["numeric_cols"]
    if column not in df.columns:
        column = numeric_cols[0] if numeric_cols else "revenue"

    if "product_category" in df.columns or "region" in df.columns:
        agg = df.groupby("date")[column].sum().reset_index()
        values = agg[column].tolist()
    else:
        values = df[column].tolist()

    result = run_scenario(values, adjustment_pct, periods)
    ai_summary = explain_scenario(
        result["baseline_forecast"], result["scenario_forecast"],
        adjustment_pct, metric=column
    )
    return {**result, "ai_summary": ai_summary, "metric": column}


# ── /chat — handles all 9 Q types ────────────────────────────────────────────

@app.post("/chat")
async def chat(
    file: UploadFile = File(...),
    question: str = Form(...),
    column: str = "revenue"
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    contents = await file.read()
    df = read_and_validate(file, contents)
    schema = get_schema(df)
    numeric_cols = schema["numeric_cols"]
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found.")

    # ── Parse intent ──────────────────────────────────────────────────────
    try:
        parsed = parse_user_question(question, schema)
    except Exception:
        parsed = {
            "intent": "forecast", "metric": numeric_cols[0], "periods": 4,
            "category_filter": None, "region_filter": None, "dimension": None,
            "adjustment_pct": None, "direction": "both", "scenario_type": "single",
            "driver_metric": None
        }

    intent = parsed.get("intent", "forecast")
    metric = parsed.get("metric") or column
    if metric not in df.columns:
        metric = numeric_cols[0]
    periods = parsed.get("periods", 4)
    category_filter = parsed.get("category_filter")
    region_filter = parsed.get("region_filter")
    dimension = parsed.get("dimension")
    adjustment_pct = parsed.get("adjustment_pct") or 10
    direction = parsed.get("direction", "both")
    scenario_type = parsed.get("scenario_type", "single")
    driver_metric = parsed.get("driver_metric")

    # Validate driver_metric if present
    if driver_metric and driver_metric not in df.columns:
        driver_metric = None

    # ── Q1 / Q2: forecast ─────────────────────────────────────────────────
    if intent == "forecast":
        result = forecast_filtered(df, metric, periods, category_filter, region_filter)
        if result is None:
            return {"intent": "forecast", "ai_summary": "Not enough data after applying filters.", "metric": metric}

        baseline = [round(sum(result["values"][-4:]) / 4, 2)] * periods
        confidence = compute_confidence(result["values"], {"seasonality_period": result.get("seasonality_period")})
        ai_summary = explain_forecast(
            result["forecast"], result["anomalies"], baseline,
            metric=metric, filter_label=result["filter_label"], question=question,
            model_used=result.get("model_used", ""),
            seasonality_period=result.get("seasonality_period")
        )
        return {
            "intent": "forecast",
            "metric": metric,
            "filter_label": result["filter_label"],
            "forecast": result["forecast"],
            "historical": result["historical"],
            "anomalies": result["anomalies"],
            "model_used": result["model_used"],
            "confidence": confidence,
            "ai_summary": ai_summary,
            "graph_type": "forecast"
        }

    # ── Q3: best_dimension ────────────────────────────────────────────────
    if intent == "best_dimension":
        dim = dimension or ("product_category" if "product_category" in df.columns else "region")
        rankings = best_by_dimension(df, metric, dim, periods)
        if not rankings:
            return {"intent": "best_dimension", "ai_summary": f"Could not rank by {dim}.", "metric": metric}

        ai_summary = explain_best_dimension(rankings, metric, dim, question)
        return {
            "intent": "best_dimension",
            "metric": metric,
            "dimension": dim,
            "rankings": rankings,
            "ai_summary": ai_summary,
            "graph_type": "rankings"
        }

    # ── Q4 / Q5: anomaly ──────────────────────────────────────────────────
    if intent == "anomaly":
        result = anomalies_filtered(df, metric, direction, category_filter, region_filter)
        if result is None:
            return {"intent": "anomaly", "ai_summary": "Not enough data after applying filters.", "metric": metric}

        # Run a forecast to get bands — used so explainer can say "outside normal range"
        fc_result = forecast_filtered(df, metric, len(result["anomalies"]) or 4,
                                       category_filter, region_filter)
        forecast_bands = fc_result["forecast"] if fc_result else None

        ai_summary = explain_anomaly(
            result["anomalies"], metric, result["filter_label"],
            result["total_points"], direction, question,
            forecast_bands=forecast_bands
        )
        return {
            "intent": "anomaly",
            "metric": metric,
            "filter_label": result["filter_label"],
            "anomalies": result["anomalies"],
            "historical": result["historical"],
            "total_points": result["total_points"],
            "ai_summary": ai_summary,
            "graph_type": "anomaly"
        }

    # ── Q6: anomaly_by_dimension ──────────────────────────────────────────
    if intent == "anomaly_by_dimension":
        dim = dimension or ("region" if "region" in df.columns else "product_category")
        signals = most_anomalous_dimension(df, metric, dim)
        if not signals:
            return {"intent": "anomaly_by_dimension", "ai_summary": f"Could not analyse by {dim}.", "metric": metric}

        ai_summary = explain_anomaly_by_dimension(signals, metric, dim, question)
        return {
            "intent": "anomaly_by_dimension",
            "metric": metric,
            "dimension": dim,
            "signals": signals,
            "ai_summary": ai_summary,
            "graph_type": "dimension_signals"
        }

    # ── Q7 / Q8: scenario ─────────────────────────────────────────────────
    if intent == "scenario":
        adj = 0.0 if scenario_type == "flat" else float(adjustment_pct)

        # Aggregate values
        if "product_category" in df.columns or "region" in df.columns:
            agg = df.groupby("date")[metric].sum().reset_index()
            values = agg[metric].tolist()
        else:
            values = df[metric].tolist()

        result = run_scenario(values, adj, periods)
        ai_summary = explain_scenario(
            result["baseline_forecast"], result["scenario_forecast"],
            adj, metric=metric, question=question
        )
        return {
            "intent": "scenario",
            "metric": metric,
            "adjustment_pct": adj,
            "comparison": result["comparison"],
            "baseline_forecast": result["baseline_forecast"],
            "scenario_forecast": result["scenario_forecast"],
            "ai_summary": ai_summary,
            "graph_type": "scenario"
        }

    # ── Q9: scenario_best_worst ───────────────────────────────────────────
    if intent == "scenario_best_worst":
        if "product_category" in df.columns or "region" in df.columns:
            agg = df.groupby("date")[metric].sum().reset_index()
            values = agg[metric].tolist()
        else:
            values = df[metric].tolist()

        best_result = run_scenario(values, 20, periods)
        worst_result = run_scenario(values, -20, periods)
        baseline_result = run_scenario(values, 0, periods)

        ai_summary = explain_scenario_best_worst(
            best_result["scenario_forecast"],
            worst_result["scenario_forecast"],
            baseline_result["baseline_forecast"],
            metric=metric, question=question
        )
        return {
            "intent": "scenario_best_worst",
            "metric": metric,
            "best_forecast": best_result["scenario_forecast"],
            "worst_forecast": worst_result["scenario_forecast"],
            "baseline_forecast": baseline_result["baseline_forecast"],
            "best_comparison": best_result["comparison"],
            "worst_comparison": worst_result["comparison"],
            "ai_summary": ai_summary,
            "graph_type": "best_worst"
        }

    # ── Q10: driver_analysis ──────────────────────────────────────────────
    if intent == "driver_analysis":
        result = driver_analysis(df, metric)
        if result.get("error"):
            return {"intent": "driver_analysis", "ai_summary": result["error"], "metric": metric}
        ai_summary = explain_driver_analysis(result, question)
        return {
            "intent": "driver_analysis",
            "metric": metric,
            "drivers": result["drivers"],
            "total_columns_analysed": result["total_columns_analysed"],
            "ai_summary": ai_summary,
            "graph_type": "driver_analysis"
        }

    # ── Q11: impact_simulation ────────────────────────────────────────────
    if intent == "impact_simulation":
        if not driver_metric:
            return {
                "intent": "impact_simulation",
                "ai_summary": "Please specify both a driver metric and a target metric. For example: 'If marketing_spend increases by 20%, what happens to revenue?'",
                "metric": metric
            }
        adj = float(adjustment_pct) if adjustment_pct else 10.0
        result = impact_simulation(df, driver_metric, metric, adj)
        if result.get("error"):
            return {"intent": "impact_simulation", "ai_summary": result["error"], "metric": metric}
        ai_summary = explain_impact_simulation(result, question)
        return {
            "intent": "impact_simulation",
            "target_metric": metric,
            "driver_metric": driver_metric,
            "change_pct": adj,
            "projected_target": result["projected_target"],
            "projected_change": result["projected_change"],
            "projected_change_pct": result["projected_change_pct"],
            "correlation": result["correlation"],
            "slope": result["slope"],
            "current_driver_avg": result["current_driver_avg"],
            "current_target_avg": result["current_target_avg"],
            "ai_summary": ai_summary,
            "graph_type": "impact_simulation"
        }

    # ── Q12: lead_indicator ───────────────────────────────────────────────
    if intent == "lead_indicator":
        if not driver_metric:
            return {
                "intent": "lead_indicator",
                "ai_summary": "Please specify two metrics. For example: 'Does marketing_spend predict revenue in advance?'",
                "metric": metric
            }
        result = lead_indicator_test(df, driver_metric, metric)
        if result.get("error"):
            return {"intent": "lead_indicator", "ai_summary": result["error"], "metric": metric}
        ai_summary = explain_lead_indicator(result, question)
        return {
            "intent": "lead_indicator",
            "col_a": driver_metric,
            "col_b": metric,
            "is_leading_indicator": result["is_leading_indicator"],
            "best_lag_weeks": result["best_lag_weeks"],
            "best_correlation": result["best_correlation"],
            "strength": result["strength"],
            "direction": result["direction"],
            "lag_results": result["lag_results"],
            "granger_significant": result["granger_significant"],
            "ai_summary": ai_summary,
            "graph_type": "lead_indicator"
        }

    # ── Q13: multivariate_forecast ────────────────────────────────────────
    if intent == "multivariate_forecast":
        drivers = [driver_metric] if driver_metric else []
        if not drivers:
            # Fall back to univariate forecast with a note
            result = forecast_filtered(df, metric, periods, None, None)
            if result is None:
                return {"intent": "multivariate_forecast", "ai_summary": "Could not generate forecast.", "metric": metric}
            baseline = [round(sum(result["values"][-4:]) / 4, 2)] * periods
            ai_summary = explain_forecast(
                result["forecast"], result["anomalies"], baseline,
                metric=metric, question=question,
                model_used=result.get("model_used", ""),
                seasonality_period=result.get("seasonality_period")
            )
            return {
                "intent": "multivariate_forecast",
                "metric": metric,
                "note": "No driver metric detected — showing standard univariate forecast.",
                "forecast": result["forecast"],
                "historical": result["historical"],
                "model_used": result["model_used"],
                "ai_summary": ai_summary,
                "graph_type": "forecast"
            }

        result = multivariate_forecast(df, metric, drivers, periods)
        if result.get("error"):
            return {"intent": "multivariate_forecast", "ai_summary": result["error"], "metric": metric}
        ai_summary = explain_multivariate_forecast(result, question)
        return {
            "intent": "multivariate_forecast",
            "target_metric": metric,
            "driver_metrics": result["driver_metrics"],
            "forecast": result["forecast"],
            "historical": result["historical"],
            "model_used": result["model_used"],
            "var_used": result["var_used"],
            "correlation_context": result["correlation_context"],
            "univariate_forecast": result["univariate_forecast"],
            "ai_summary": ai_summary,
            "graph_type": "forecast"
        }

    # Fallback — treat as forecast
    result = forecast_filtered(df, metric, periods, None, None)
    if result is None:
        return {"intent": "forecast", "ai_summary": "Could not generate forecast.", "metric": metric}
    baseline = [round(sum(result["values"][-4:]) / 4, 2)] * periods
    ai_summary = explain_forecast(
        result["forecast"], result["anomalies"], baseline,
        metric=metric, question=question,
        model_used=result.get("model_used", ""),
        seasonality_period=result.get("seasonality_period")
    )
    return {
        "intent": "forecast",
        "metric": metric,
        "filter_label": "",
        "forecast": result["forecast"],
        "historical": result["historical"],
        "anomalies": result["anomalies"],
        "model_used": result["model_used"],
        "ai_summary": ai_summary,
        "graph_type": "forecast"
    }