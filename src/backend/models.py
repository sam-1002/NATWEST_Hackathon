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


# ══════════════════════════════════════════════════════════════════════════════
# MULTIVARIATE ANALYSIS — Q10, Q11, Q12, Q13
# ══════════════════════════════════════════════════════════════════════════════

def _validate_mv_columns(df: pd.DataFrame, col_a: str, col_b: str = None):
    """
    Validate that columns exist and have enough numeric, non-null data.
    Returns (agg_df, error_string). error_string is None if all good.
    """
    cols_needed = [col_a] + ([col_b] if col_b else [])
    for c in cols_needed:
        if c not in df.columns:
            return None, f"Column '{c}' not found in the dataset."
        if not pd.api.types.is_numeric_dtype(df[c]):
            return None, f"Column '{c}' is not numeric."

    group_cols = ["date"] + cols_needed
    agg = df.groupby("date")[cols_needed].sum().reset_index().sort_values("date")
    agg = agg.dropna(subset=cols_needed)

    if len(agg) < 12:
        return None, f"Need at least 12 data points after aggregation — only {len(agg)} found."

    return agg, None


def driver_analysis(df: pd.DataFrame, target_metric: str):
    """
    Q10 — 'What is driving [metric]?'
    Computes Pearson correlation of every other numeric column against target.
    Returns top drivers ranked by absolute correlation, with direction and strength label.
    Fallback: returns empty list with error message on failure.
    """
    numeric_cols = [
        c for c in df.columns
        if c != "date" and pd.api.types.is_numeric_dtype(df[c]) and c != target_metric
    ]

    if target_metric not in df.columns:
        return {"error": f"Column '{target_metric}' not found.", "drivers": []}
    if not numeric_cols:
        return {"error": "No other numeric columns to correlate against.", "drivers": []}

    agg = df.groupby("date")[numeric_cols + [target_metric]].sum().reset_index().sort_values("date")
    agg = agg.dropna()

    if len(agg) < 12:
        return {"error": f"Need at least 12 data points — only {len(agg)} found.", "drivers": []}

    target_series = agg[target_metric]
    drivers = []

    for col in numeric_cols:
        try:
            corr = float(np.corrcoef(agg[col], target_series)[0, 1])
            if np.isnan(corr):
                continue
            abs_corr = abs(corr)
            strength = "strong" if abs_corr >= 0.7 else "moderate" if abs_corr >= 0.4 else "weak"
            direction = "positive" if corr > 0 else "negative"
            drivers.append({
                "column": col,
                "correlation": round(corr, 3),
                "abs_correlation": round(abs_corr, 3),
                "direction": direction,
                "strength": strength,
                "summary": f"{col} has a {strength} {direction} relationship with {target_metric} (r={corr:+.2f})"
            })
        except Exception:
            continue

    drivers.sort(key=lambda x: x["abs_correlation"], reverse=True)
    top_drivers = drivers[:5]  # Cap at 5

    return {
        "target": target_metric,
        "drivers": top_drivers,
        "total_columns_analysed": len(numeric_cols),
        "error": None
    }


def impact_simulation(df: pd.DataFrame, driver_metric: str, target_metric: str, change_pct: float):
    """
    Q11 — 'How does a N% change in [driver] affect [target]?'
    Uses OLS regression slope to estimate the effect.
    Returns projected change in target and plain-English summary.
    Fallback: returns error key if insufficient data or columns missing.
    """
    agg, err = _validate_mv_columns(df, driver_metric, target_metric)
    if err:
        return {"error": err}

    try:
        x = agg[driver_metric].values.astype(float)
        y = agg[target_metric].values.astype(float)

        # OLS: y = slope * x + intercept
        x_mean, y_mean = x.mean(), y.mean()
        slope = float(np.sum((x - x_mean) * (y - y_mean)) / np.sum((x - x_mean) ** 2))
        intercept = float(y_mean - slope * x_mean)
        corr = float(np.corrcoef(x, y)[0, 1])

        # Current averages
        current_driver_avg = float(x_mean)
        current_target_avg = float(y_mean)

        # Projected change
        driver_delta = current_driver_avg * (change_pct / 100)
        target_delta = slope * driver_delta
        projected_target = current_target_avg + target_delta
        projected_pct = (target_delta / current_target_avg * 100) if current_target_avg != 0 else 0

        direction_word = "increase" if change_pct > 0 else "decrease"
        effect_word = "increase" if target_delta > 0 else "decrease"

        return {
            "driver_metric": driver_metric,
            "target_metric": target_metric,
            "change_pct": change_pct,
            "slope": round(slope, 4),
            "correlation": round(corr, 3),
            "current_driver_avg": round(current_driver_avg, 2),
            "current_target_avg": round(current_target_avg, 2),
            "projected_target": round(projected_target, 2),
            "projected_change": round(target_delta, 2),
            "projected_change_pct": round(projected_pct, 2),
            "summary": (
                f"A {abs(change_pct):.0f}% {direction_word} in {driver_metric} "
                f"is associated with a {abs(projected_pct):.1f}% {effect_word} in {target_metric} "
                f"(projected: {projected_target:,.2f} vs current avg {current_target_avg:,.2f})."
            ),
            "error": None
        }
    except Exception as e:
        return {"error": f"Regression failed: {str(e)}"}


def lead_indicator_test(df: pd.DataFrame, col_a: str, col_b: str, max_lag: int = 3):
    """
    Q12 — 'Does [metric A] predict [metric B] in advance?'
    Runs cross-correlation at lags 1–max_lag.
    If statsmodels grangercausalitytests available, uses Granger causality.
    Falls back to cross-correlation if Granger fails.
    Returns best lag, correlation strength, and whether A reliably predicts B.
    """
    agg, err = _validate_mv_columns(df, col_a, col_b)
    if err:
        return {"error": err}

    try:
        x = agg[col_a].values.astype(float)
        y = agg[col_b].values.astype(float)

        # Cross-correlation at each lag
        lag_results = []
        for lag in range(1, max_lag + 1):
            if lag >= len(x):
                break
            x_lagged = x[:-lag]
            y_future = y[lag:]
            if len(x_lagged) < 8:
                continue
            corr = float(np.corrcoef(x_lagged, y_future)[0, 1])
            if not np.isnan(corr):
                lag_results.append({"lag_weeks": lag, "correlation": round(corr, 3)})

        if not lag_results:
            return {"error": "Could not compute cross-correlation — insufficient data at any lag."}

        best = max(lag_results, key=lambda r: abs(r["correlation"]))
        best_corr = best["correlation"]
        best_lag = best["lag_weeks"]

        # Try Granger causality
        granger_result = None
        granger_significant = False
        try:
            from statsmodels.tsa.stattools import grangercausalitytests
            test_data = np.column_stack([y, x])
            gc = grangercausalitytests(test_data, maxlag=max_lag, verbose=False)
            # Check if any lag is significant at p < 0.05
            for lag_key, lag_val in gc.items():
                p_val = lag_val[0]["ssr_ftest"][1]
                if p_val < 0.05:
                    granger_significant = True
                    granger_result = {"lag": lag_key, "p_value": round(p_val, 4)}
                    break
        except Exception:
            pass  # Fall back to cross-correlation result

        abs_corr = abs(best_corr)
        strength = "strong" if abs_corr >= 0.6 else "moderate" if abs_corr >= 0.35 else "weak"
        is_predictor = abs_corr >= 0.35 or granger_significant
        direction = "positive" if best_corr > 0 else "inverse"

        return {
            "col_a": col_a,
            "col_b": col_b,
            "is_leading_indicator": is_predictor,
            "best_lag_weeks": best_lag,
            "best_correlation": best_corr,
            "strength": strength,
            "direction": direction,
            "lag_results": lag_results,
            "granger_significant": granger_significant,
            "granger_detail": granger_result,
            "summary": (
                f"{'Yes' if is_predictor else 'No'} — {col_a} {'is' if is_predictor else 'is not'} "
                f"a reliable leading indicator for {col_b}. "
                f"Best predictive lag: {best_lag} week(s) ahead "
                f"(correlation: {best_corr:+.2f}, {strength})."
            ),
            "error": None
        }
    except Exception as e:
        return {"error": f"Lead indicator test failed: {str(e)}"}


def multivariate_forecast(df: pd.DataFrame, target_metric: str, driver_metrics: list, periods: int = 4):
    """
    Q13 — 'Forecast [target] using [driver] for the next N weeks'
    Uses VAR (Vector Autoregression) with up to 2 drivers.
    Falls back to univariate forecast + correlation note if VAR fails.
    Returns low/likely/high bands consistent with existing forecast format.
    """
    # Cap drivers at 2 for stability
    drivers = driver_metrics[:2]

    # Validate all columns
    all_cols = [target_metric] + drivers
    for c in all_cols:
        if c not in df.columns:
            return {"error": f"Column '{c}' not found in the dataset."}
        if not pd.api.types.is_numeric_dtype(df[c]):
            return {"error": f"Column '{c}' is not numeric."}

    agg = df.groupby("date")[all_cols].sum().reset_index().sort_values("date")
    agg = agg.dropna(subset=all_cols)

    if len(agg) < 12:
        return {"error": f"Need at least 12 data points — only {len(agg)} found."}

    last_date = agg["date"].max()
    target_values = agg[target_metric].tolist()
    model_used = "Univariate (fallback)"
    forecast_vals = []

    # Try VAR
    var_success = False
    try:
        from statsmodels.tsa.vector_ar.var_model import VAR
        var_data = agg[all_cols].values.astype(float)
        # Select optimal lag (max 4, min 1)
        var_model = VAR(var_data)
        lag_order = var_model.select_order(maxlags=min(4, len(agg) // 4))
        best_lag = lag_order.selected_orders.get("aic", 1) or 1
        best_lag = max(1, min(best_lag, 4))

        fitted = var_model.fit(best_lag)
        # Forecast
        fc = fitted.forecast(var_data[-best_lag:], steps=periods)
        target_idx = all_cols.index(target_metric)
        forecast_vals = [float(row[target_idx]) for row in fc]
        model_used = f"VAR(lag={best_lag})"
        var_success = True
    except Exception:
        pass

    # Fallback to univariate ETS if VAR failed
    if not var_success:
        try:
            ets_vals, _ = run_forecast_ets(target_values, periods, detect_seasonality(target_values))
            forecast_vals = ets_vals
            model_used = "Exponential Smoothing (fallback)"
        except Exception as e:
            return {"error": f"Both VAR and fallback forecast failed: {str(e)}"}

    # Build output with low/likely/high bands (consistent with existing format)
    std = float(np.std(target_values[-8:]))
    last_val = target_values[-1]
    results = []
    for i, val in enumerate(forecast_vals):
        growth_pct = ((val - last_val) / last_val * 100) if last_val else 0
        fd = last_date + timedelta(weeks=i + 1)
        results.append({
            "period": i + 1,
            "date_label": fd.strftime("%b %d"),
            "low": round(val - 1.5 * std, 2),
            "likely": round(val, 2),
            "high": round(val + 1.5 * std, 2),
            "growth_pct": round(growth_pct, 2)
        })

    # Correlation context for explainer
    corr_context = []
    for d in drivers:
        try:
            corr = float(np.corrcoef(agg[d].values, agg[target_metric].values)[0, 1])
            corr_context.append({"driver": d, "correlation": round(corr, 3)})
        except Exception:
            pass

    # Also run univariate for comparison
    univariate_result = run_forecast(target_values, periods)

    return {
        "target_metric": target_metric,
        "driver_metrics": drivers,
        "forecast": results,
        "model_used": model_used,
        "var_used": var_success,
        "correlation_context": corr_context,
        "univariate_forecast": univariate_result["forecast"],
        "historical": [
            {"date": str(agg["date"].iloc[i].date()), "value": round(v, 2)}
            for i, v in enumerate(target_values)
        ],
        "last_date": last_date,
        "error": None
    }


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