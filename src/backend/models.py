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

        if abs(z) > 2 or iqr_flag:
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