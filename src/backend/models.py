import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings("ignore")

from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller, acf
from statsmodels.tsa.seasonal import seasonal_decompose
from datetime import timedelta


def detect_seasonality(values: list):
    if len(values) < 12:
        return None
    acf_vals = acf(values, nlags=12)
    if acf_vals[7] > 0.5:
        return 7
    if acf_vals[12] > 0.5:
        return 12
    return None


def run_forecast_ets(values: list, periods: int, seasonal_periods=None):
    series = pd.Series(values, dtype=float)
    if seasonal_periods and len(values) >= 2 * seasonal_periods:
        model = ExponentialSmoothing(series, trend="add", seasonal="add",
                                     seasonal_periods=seasonal_periods, initialization_method="estimated")
    else:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
    fit = model.fit()
    return fit.forecast(periods).tolist(), fit.aic


def run_forecast_arima(values: list, periods: int):
    series = pd.Series(values, dtype=float)
    best_aic, best_model = float("inf"), None
    best_order = (1, 1, 1)
    for p in range(3):
        for d in range(2):
            for q in range(3):
                try:
                    fit = ARIMA(series, order=(p, d, q)).fit()
                    if fit.aic < best_aic:
                        best_aic, best_order, best_model = fit.aic, (p, d, q), fit
                except:
                    continue
    if best_model is None:
        best_model = ARIMA(series, order=(1, 1, 1)).fit()
        best_aic = best_model.aic
    return best_model.forecast(periods).tolist(), best_aic, best_order


def run_forecast(values: list, periods: int = 4):
    seasonal_period = detect_seasonality(values)
    ets_forecast, ets_aic = run_forecast_ets(values, periods, seasonal_period)
    try:
        arima_forecast, arima_aic, order = run_forecast_arima(values, periods)
        if arima_aic < ets_aic:
            best_forecast, model_used = arima_forecast, f"ARIMA{order}"
        else:
            best_forecast, model_used = ets_forecast, "Exponential Smoothing"
    except:
        best_forecast, model_used = ets_forecast, "Exponential Smoothing"

    std = np.std(values[-8:])
    last_value = values[-1]
    results = []
    for i, val in enumerate(best_forecast):
        growth_pct = ((val - last_value) / last_value) * 100 if last_value else 0
        results.append({
            "period": i + 1,
            "low": round(val - 1.5 * std, 2),
            "likely": round(val, 2),
            "high": round(val + 1.5 * std, 2),
            "growth_pct": round(growth_pct, 2)
        })
    return {"forecast": results, "model_used": model_used, "seasonality_period": seasonal_period}


def attach_forecast_dates(forecast: list, last_date) -> list:
    """Attach real calendar date labels to each forecast period."""
    for i, f in enumerate(forecast):
        fd = last_date + timedelta(weeks=i + 1)
        f["date_label"] = fd.strftime("%b %d")
    return forecast


def detect_anomalies(values: list, dates: list = None):
    """Detect anomalies, optionally attaching real dates."""
    series = np.array(values, dtype=float)
    mean, std = np.mean(series), np.std(series)
    q1, q3 = np.percentile(series, 25), np.percentile(series, 75)
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

    anomalies = []
    for i, v in enumerate(series):
        z = (v - mean) / std if std > 0 else 0
        iqr_flag = v < lower or v > upper
        if abs(z) > 1.8 or iqr_flag:
            severity = "severe" if abs(z) > 3 else "moderate" if abs(z) > 2.5 else "mild"
            entry = {
                "index": i,
                "value": round(v, 2),
                "z_score": round(z, 2),
                "direction": "spike" if z > 0 else "dip",
                "pct_from_mean": round(((v - mean) / mean) * 100, 2),
                "severity": severity,
                "next_step": f"Investigate {'spike' if z > 0 else 'dip'} — value is {abs(round(((v - mean) / mean) * 100, 1))}% {'above' if z > 0 else 'below'} average."
            }
            if dates and i < len(dates):
                entry["date"] = str(dates[i])
            anomalies.append(entry)
    return anomalies


def forecast_filtered(df: pd.DataFrame, metric: str, periods: int,
                       category_filter: str = None, region_filter: str = None):
    """
    Filter df by category and/or region, then run forecast on the metric.
    Returns forecast result + filtered historical + filter_label.
    """
    fdf = df.copy()
    filter_parts = []

    if category_filter and "product_category" in fdf.columns:
        fdf = fdf[fdf["product_category"].str.lower() == category_filter.lower()]
        filter_parts.append(category_filter)

    if region_filter and "region" in fdf.columns:
        fdf = fdf[fdf["region"].str.lower() == region_filter.lower()]
        filter_parts.append(region_filter)

    filter_label = " · ".join(filter_parts) if filter_parts else ""

    if metric not in fdf.columns:
        return None

    # Aggregate by date
    agg = fdf.groupby("date")[metric].sum().reset_index().sort_values("date")
    if len(agg) < 4:
        return None

    values = agg[metric].tolist()
    dates = [d.date() for d in agg["date"]]
    last_date = agg["date"].max()

    forecast_result = run_forecast(values, periods)
    attach_forecast_dates(forecast_result["forecast"], last_date)
    anomalies = detect_anomalies(values, dates)

    historical = [
        {"date": str(dates[i]), "value": round(v, 2)}
        for i, v in enumerate(values)
    ]

    return {
        "forecast": forecast_result["forecast"],
        "model_used": forecast_result["model_used"],
        "seasonality_period": forecast_result["seasonality_period"],
        "historical": historical,
        "anomalies": anomalies,
        "filter_label": filter_label,
        "values": values,
        "last_date": last_date
    }


def anomalies_filtered(df: pd.DataFrame, metric: str, direction: str = "both",
                        category_filter: str = None, region_filter: str = None):
    """
    Filter df, detect anomalies on metric, optionally filter by direction.
    """
    result = forecast_filtered(df, metric, periods=1,
                                category_filter=category_filter,
                                region_filter=region_filter)
    if result is None:
        return None

    anomalies = result["anomalies"]
    if direction == "spike":
        anomalies = [a for a in anomalies if a["direction"] == "spike"]
    elif direction == "dip":
        anomalies = [a for a in anomalies if a["direction"] == "dip"]

    return {
        "anomalies": anomalies,
        "historical": result["historical"],
        "filter_label": result["filter_label"],
        "total_points": len(result["values"])
    }


def best_by_dimension(df: pd.DataFrame, metric: str, dimension: str, periods: int = 4):
    """
    For each unique value of dimension (e.g. product_category or region),
    forecast metric and rank by forecasted total.
    Returns list of dicts sorted by forecasted revenue desc.
    """
    if dimension not in df.columns or metric not in df.columns:
        return []

    grouped = df.groupby(["date", dimension])[metric].sum().reset_index()
    values_list = grouped[dimension].unique()
    results = []

    for val in values_list:
        sub = grouped[grouped[dimension] == val].sort_values("date")
        values = sub[metric].tolist()
        dates = [d.date() for d in sub["date"]]
        last_date = sub["date"].max()
        if len(values) < 4:
            continue
        try:
            fr = run_forecast(values, periods)
            attach_forecast_dates(fr["forecast"], last_date)
            total = sum(f["likely"] for f in fr["forecast"])
            last4_avg = np.mean(values[-4:])
            growth_pct = ((total / periods - last4_avg) / last4_avg) * 100 if last4_avg > 0 else 0

            historical = [{"date": str(dates[i]), "value": round(v, 2)} for i, v in enumerate(values)]

            results.append({
                "value": val,
                "forecasted_total": round(total, 2),
                "forecasted_weekly_avg": round(total / periods, 2),
                "current_weekly_avg": round(last4_avg, 2),
                "growth_pct": round(growth_pct, 2),
                "forecast": fr["forecast"],
                "historical": historical,
                "model_used": fr["model_used"]
            })
        except:
            continue

    results.sort(key=lambda x: x["forecasted_total"], reverse=True)
    return results


def most_anomalous_dimension(df: pd.DataFrame, metric: str, dimension: str):
    """
    For each unique value of dimension, detect anomalies and compute growth signal.
    Returns list sorted by anomaly count desc (watch items first).
    """
    if dimension not in df.columns or metric not in df.columns:
        return []

    grouped = df.groupby(["date", dimension])[metric].sum().reset_index()
    dim_values = grouped[dimension].unique()
    results = []

    for val in dim_values:
        sub = grouped[grouped[dimension] == val].sort_values("date")
        values = sub[metric].tolist()
        dates = [d.date() for d in sub["date"]]
        if len(values) < 4:
            continue

        anomalies = detect_anomalies(values, dates)

        if len(values) >= 8:
            recent = np.mean(values[-4:])
            prior = np.mean(values[-8:-4])
            growth_pct = ((recent - prior) / prior) * 100 if prior > 0 else 0
        else:
            recent = np.mean(values[-min(4, len(values)):])
            growth_pct = 0

        has_anomaly = len(anomalies) > 0
        is_surging = growth_pct > 15
        is_declining = growth_pct < -10

        if has_anomaly and is_surging:
            signal, signal_label = "anomaly_surge", "Anomaly + Surge"
        elif has_anomaly and is_declining:
            signal, signal_label = "anomaly_decline", "Anomaly + Decline"
        elif has_anomaly:
            signal, signal_label = "anomaly", "Anomaly Detected"
        elif is_surging:
            signal, signal_label = "surge", "Strong Growth"
        elif is_declining:
            signal, signal_label = "decline", "Declining"
        else:
            signal, signal_label = "stable", "Stable"

        watch = signal not in ("stable",)
        historical = [{"date": str(dates[i]), "value": round(v, 2)} for i, v in enumerate(values)]

        results.append({
            "value": val,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
            "growth_pct": round(growth_pct, 2),
            "recent_avg": round(recent, 2),
            "signal": signal,
            "signal_label": signal_label,
            "watch": watch,
            "historical": historical
        })

    results.sort(key=lambda x: (not x["watch"], -x["anomaly_count"], -abs(x["growth_pct"])))
    return results


def forecast_by_category(df: pd.DataFrame, periods: int = 4):
    """Wrapper kept for /insights endpoint compatibility."""
    results = best_by_dimension(df, "revenue", "product_category", periods)
    # Rename 'value' → 'category' for backward compat
    for r in results:
        r["category"] = r.pop("value")
    return results


def analyze_regions(df: pd.DataFrame):
    """Wrapper kept for /insights endpoint compatibility."""
    results = most_anomalous_dimension(df, "revenue", "region")
    for r in results:
        r["region"] = r.pop("value")
        r["recent_avg_revenue"] = r.pop("recent_avg")
    return results
