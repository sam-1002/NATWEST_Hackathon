import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings("ignore")

from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller, acf
from statsmodels.tsa.seasonal import seasonal_decompose


def load_data(filepath: str):
    df = pd.read_csv(filepath, parse_dates=["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df


def compute_baseline(values: list, periods: int):
    avg = np.mean(values[-4:])
    return [round(avg, 2)] * periods


def make_stationary(series):
    result = adfuller(series)
    p_value = result[1]
    if p_value > 0.05:
        return np.diff(series), 1
    return series, 0


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
        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add",
            seasonal_periods=seasonal_periods,
            initialization_method="estimated"
        )
    else:
        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal=None,
            initialization_method="estimated"
        )
    fit = model.fit()
    forecast = fit.forecast(periods)
    return forecast.tolist(), fit.aic


def run_forecast_arima(values: list, periods: int):
    series = pd.Series(values, dtype=float)
    best_aic = float("inf")
    best_order = (1, 1, 1)
    best_model = None
    for p in range(3):
        for d in range(2):
            for q in range(3):
                try:
                    model = ARIMA(series, order=(p, d, q))
                    fit = model.fit()
                    if fit.aic < best_aic:
                        best_aic = fit.aic
                        best_order = (p, d, q)
                        best_model = fit
                except:
                    continue
    if best_model is None:
        model = ARIMA(series, order=(1, 1, 1))
        best_model = model.fit()
        best_aic = best_model.aic
    forecast = best_model.forecast(periods)
    return forecast.tolist(), best_aic, best_order


def decompose_series(values: list, period=None):
    if period is None or len(values) < 2 * period:
        return None
    series = pd.Series(values)
    result = seasonal_decompose(series, period=period)
    return {
        "trend": [round(x, 2) if not np.isnan(x) else None for x in result.trend.tolist()],
        "seasonal": [round(x, 2) if not np.isnan(x) else None for x in result.seasonal.tolist()],
        "residual": [round(x, 2) if not np.isnan(x) else None for x in result.resid.tolist()]
    }


def run_forecast(values: list, periods: int = 4):
    seasonal_period = detect_seasonality(values)

    ets_forecast, ets_aic = run_forecast_ets(values, periods, seasonal_period)

    try:
        arima_forecast, arima_aic, order = run_forecast_arima(values, periods)
        if arima_aic < ets_aic:
            best_forecast = arima_forecast
            model_used = f"ARIMA{order}"
        else:
            best_forecast = ets_forecast
            model_used = "Exponential Smoothing"
    except:
        best_forecast = ets_forecast
        model_used = "Exponential Smoothing"

    std = np.std(values[-8:])
    last_value = values[-1]

    results = []
    for i, val in enumerate(best_forecast):
        growth_pct = ((val - last_value) / last_value) * 100
        results.append({
            "period": i + 1,
            "low": round(val - 1.5 * std, 2),
            "likely": round(val, 2),
            "high": round(val + 1.5 * std, 2),
            "growth_pct": round(growth_pct, 2)
        })

    decomposition = decompose_series(values, seasonal_period)

    return {
        "forecast": results,
        "model_used": model_used,
        "seasonality_period": seasonal_period,
        "decomposition": decomposition
    }


def detect_anomalies(values: list, forecast_bands: list = None):
    series = np.array(values, dtype=float)
    mean = np.mean(series)
    std = np.std(series)

    q1 = np.percentile(series, 25)
    q3 = np.percentile(series, 75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    anomalies = []
    for i, v in enumerate(series):
        z = (v - mean) / std if std > 0 else 0
        iqr_flag = v < lower or v > upper

        if abs(z) > 1.8 or iqr_flag:
            outside_band = False
            if forecast_bands and i < len(forecast_bands):
                band = forecast_bands[i]
                outside_band = v < band["low"] or v > band["high"]

            anomalies.append({
                "index": i,
                "value": round(v, 2),
                "z_score": round(z, 2),
                "direction": "spike" if z > 0 else "dip",
                "pct_from_mean": round(((v - mean) / mean) * 100, 2),
                "outside_forecast_band": outside_band,
                "next_step": f"Investigate data point {i} — value is {abs(round(((v - mean) / mean) * 100, 1))}% {'above' if z > 0 else 'below'} average."
            })

    return anomalies


# ─── Multi-dimensional analysis for date|category|region|units_sold|revenue|profit ───

def forecast_by_category(df: pd.DataFrame, periods: int = 4):
    """
    Groups revenue by product_category over time, forecasts each category,
    and returns them ranked by total forecasted revenue (best first).
    Requires columns: date, product_category, revenue
    """
    if "product_category" not in df.columns or "revenue" not in df.columns:
        return []
    
    # Clean comma-formatted numbers
    df = df.copy()
    df["revenue"] = df["revenue"].astype(str).str.replace(",", "", regex=False)
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)
    
    # Aggregate: total revenue per (date, category)
    grouped = df.groupby(["date", "product_category"])["revenue"].sum().reset_index()
    categories = grouped["product_category"].unique()

    results = []
    for cat in categories:
        cat_df = grouped[grouped["product_category"] == cat].sort_values("date")
        values = cat_df["revenue"].tolist()

        if len(values) < 4:
            continue

        try:
            forecast_result = run_forecast(values, periods)
            forecast = forecast_result["forecast"]
            total_forecasted = sum(f["likely"] for f in forecast)
            last_4_avg = np.mean(values[-4:])
            growth_pct = ((total_forecasted / periods - last_4_avg) / last_4_avg) * 100 if last_4_avg > 0 else 0

            results.append({
                "category": cat,
                "forecasted_total": round(total_forecasted, 2),
                "forecasted_weekly_avg": round(total_forecasted / periods, 2),
                "current_weekly_avg": round(last_4_avg, 2),
                "growth_pct": round(growth_pct, 2),
                "forecast": forecast,
                "model_used": forecast_result["model_used"]
            })
        except Exception:
            continue

    # Sort by forecasted total revenue descending
    results.sort(key=lambda x: x["forecasted_total"], reverse=True)
    return results


def analyze_regions(df: pd.DataFrame):
    """
    Groups revenue by region over time.
    For each region:
    - Computes recent growth (last 4 weeks vs prior 4 weeks)
    - Detects anomalies in the revenue series
    - Flags as 'watch' if anomaly exists OR growth > 15% or < -10%
    Requires columns: date, region, revenue
    """
    if "region" not in df.columns or "revenue" not in df.columns:
        return []
    
    # Clean comma-formatted numbers
    df = df.copy()
    df["revenue"] = df["revenue"].astype(str).str.replace(",", "", regex=False)
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)
    
    grouped = df.groupby(["date", "region"])["revenue"].sum().reset_index()
    regions = grouped["region"].unique()

    results = []
    for region in regions:
        reg_df = grouped[grouped["region"] == region].sort_values("date")
        values = reg_df["revenue"].tolist()

        if len(values) < 4:
            continue

        # Growth signal: compare last 4 vs prior 4
        if len(values) >= 8:
            recent = np.mean(values[-4:])
            prior = np.mean(values[-8:-4])
            growth_pct = ((recent - prior) / prior) * 100 if prior > 0 else 0
        else:
            recent = np.mean(values[-min(4, len(values)):])
            growth_pct = 0

        anomalies = detect_anomalies(values)
        has_anomaly = len(anomalies) > 0
        is_surging = growth_pct > 15
        is_declining = growth_pct < -10

        # Signal classification
        if has_anomaly and is_surging:
            signal = "anomaly_surge"
            signal_label = "Anomaly + Surge"
        elif has_anomaly and is_declining:
            signal = "anomaly_decline"
            signal_label = "Anomaly + Decline"
        elif has_anomaly:
            signal = "anomaly"
            signal_label = "Anomaly Detected"
        elif is_surging:
            signal = "surge"
            signal_label = "Strong Growth"
        elif is_declining:
            signal = "decline"
            signal_label = "Declining"
        else:
            signal = "stable"
            signal_label = "Stable"

        watch = signal not in ("stable",)

        results.append({
            "region": region,
            "growth_pct": round(growth_pct, 2),
            "recent_avg_revenue": round(recent, 2),
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
            "signal": signal,
            "signal_label": signal_label,
            "watch": watch
        })

    # Sort: watch regions first, then by abs growth
    results.sort(key=lambda x: (not x["watch"], -abs(x["growth_pct"])))
    return results
