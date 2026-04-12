from fastapi import Form
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.backend.models import run_forecast, detect_anomalies, forecast_by_category, analyze_regions
from src.backend.scenario import run_scenario
from src.backend.explainer import explain_forecast, explain_scenario, explain_insights
import pandas as pd
import io
import math
from datetime import timedelta
import sys


def clean_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if col == "date":
            continue
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(",", "", regex=False)
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notna().sum() > len(df) * 0.5:
                df[col] = converted.fillna(0)
    return df

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


def compute_confidence(values, forecast_result):
    n = len(values)
    mean = sum(values) / n if n > 0 else 1
    std = (sum((v - mean) ** 2 for v in values) / n) ** 0.5
    cv = std / abs(mean) if mean != 0 else 1
    length_score = min(40, (n / 52) * 40)
    volatility_score = max(0, 40 * (1 - min(cv, 1)))
    seasonality_score = 20 if forecast_result.get("seasonality_period") else 0
    total = round(length_score + volatility_score + seasonality_score)
    total = max(10, min(99, total))
    label = "High" if total >= 75 else "Moderate" if total >= 50 else "Low"
    return {"score": total, "label": label}


def generate_forecast_dates(df, periods):
    last_date = df["date"].max()
    dates = []
    for i in range(1, periods + 1):
        fd = last_date + timedelta(weeks=i)
        dates.append(fd.strftime("%b %d"))
    return dates


def validate_csv(file, contents):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file only.")
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file. Make sure it is a valid CSV file.")
    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")
    return df


def detect_schema(df: pd.DataFrame) -> dict:
    schema = {
        "numeric_cols": [],
        "categorical_cols": {},
        "row_count": len(df)
    }
    for col in df.columns:
        if col == "date":
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            schema["numeric_cols"].append(col)
        elif df[col].dtype == object:
            unique_vals = df[col].dropna().unique().tolist()
            if len(unique_vals) <= 50:
                schema["categorical_cols"][col] = unique_vals
    return schema


@app.post("/schema")
async def get_schema(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file.")
    df = clean_numeric_columns(df)
    schema = detect_schema(df)
    preview_cols = ["date"] + schema["numeric_cols"][:5] + list(schema["categorical_cols"].keys())[:3]
    preview_cols = [c for c in preview_cols if c in df.columns]
    preview = df[preview_cols].head(5).copy()
    if "date" in preview.columns:
        preview["date"] = pd.to_datetime(preview["date"]).dt.strftime("%Y-%m-%d")
    return {
        "schema": schema,
        "preview": preview.to_dict(orient="records"),
        "all_columns": [c for c in df.columns if c != "date"]
    }


@app.post("/forecast_smart")
async def forecast_smart(
    file: UploadFile = File(...),
    column: str = "revenue",
    periods: int = 4,
    filters: str = "{}"
):
    import json
    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No date column found.")

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df = clean_numeric_columns(df)

    # Apply filters dynamically
    filter_dict = json.loads(filters)
    filter_description = []
    for filter_col, filter_val in filter_dict.items():
        if filter_col in df.columns:
            df = df[df[filter_col].astype(str).str.lower() == str(filter_val).lower()]
            filter_description.append(f"{filter_col}={filter_val}")

    if len(df) < 4:
        raise HTTPException(status_code=400, detail=f"Not enough data after filtering ({len(df)} rows). Try broader filters.")

    # Auto-detect numeric cols after filtering
    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    if column not in numeric_cols:
        column = numeric_cols[0] if numeric_cols else None
    if not column:
        raise HTTPException(status_code=400, detail="No numeric column found.")

    # Aggregate by date
    agg = df.groupby("date")[column].sum().reset_index()
    values = agg[column].tolist()

    forecast_result = run_forecast(values, periods)
    anomalies = detect_anomalies(values)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(values, forecast_result)
    forecast_dates = generate_forecast_dates(agg, periods)

    for i, f in enumerate(forecast_result["forecast"]):
        f["date_label"] = forecast_dates[i] if i < len(forecast_dates) else f"W+{f['period']}"

    filter_label = " · ".join(filter_description) if filter_description else "All data"

    return {
        "forecast": forecast_result["forecast"],
        "historical": [{"date": str(row["date"].date()), "value": row[column]} for _, row in agg.iterrows()],
        "anomalies": anomalies,
        "baseline": baseline,
        "confidence": confidence,
        "model_used": forecast_result["model_used"],
        "column": column,
        "filters_applied": filter_dict,
        "filter_label": filter_label,
        "row_count": len(df),
        "periods": periods
    }


@app.post("/forecast")
async def forecast(file: UploadFile = File(...), periods: int = 4, column: str = "value"):

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file only.")

    contents = await file.read()

    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")

    numeric_cols = [col for col in df.columns if col != "date" and pd.api.types.is_numeric_dtype(df[col])]

    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found in your CSV.")

    if len(df) < 10:
        raise HTTPException(status_code=400, detail=f"Only {len(df)} data points found. Please provide at least 10.")

    if column not in df.columns:
        column = numeric_cols[0]

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df = clean_numeric_columns(df)
    values = df[column].tolist()

    forecast_result = run_forecast(values, periods)
    anomalies = detect_anomalies(values)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(values, forecast_result)
    forecast_dates = generate_forecast_dates(df, periods)

    for i, f in enumerate(forecast_result["forecast"]):
        f["date_label"] = forecast_dates[i] if i < len(forecast_dates) else f"W+{f['period']}"

    ai_summary = explain_forecast(forecast_result["forecast"], anomalies, baseline)

    preview_rows = df[["date", column]].head(5).copy()
    preview_rows["date"] = preview_rows["date"].dt.strftime("%Y-%m-%d")
    preview = preview_rows.rename(columns={column: "value"}).to_dict(orient="records")

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
        "historical": [
            {"date": str(row["date"].date()), "value": row[column]}
            for _, row in df.iterrows()
        ]
    }


@app.post("/insights")
async def insights(file: UploadFile = File(...), periods: int = 4):
    """
    Multi-dimensional endpoint for date|product_category|region|units_sold|revenue|profit datasets.
    Returns:
    - Total revenue forecast with confidence bands
    - Best performing category ranking
    - Region signals (growth + anomaly detection)
    - One plain-English AI summary
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file only.")

    contents = await file.read()

    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")

    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found in your CSV.")

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df = clean_numeric_columns(df)

    if len(df) < 10:
        raise HTTPException(status_code=400, detail=f"Only {len(df)} rows found. Please provide at least 10.")

    # ── 1. Total Revenue Forecast ───────────────────────────────────────────
    # Aggregate total revenue per date across all categories/regions
    # Auto-detect the main numeric column (prefer revenue if exists)
    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    main_col = "revenue" if "revenue" in df.columns else numeric_cols[0]
    total_revenue_by_date = df.groupby("date")[main_col].sum().reset_index()
    total_revenue_by_date = total_revenue_by_date.rename(columns={main_col: "revenue"})
    total_revenue_values = total_revenue_by_date["revenue"].tolist()

    revenue_forecast_result = run_forecast(total_revenue_values, periods)
    revenue_anomalies = detect_anomalies(total_revenue_values)
    baseline = [round(sum(total_revenue_values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(total_revenue_values, revenue_forecast_result)
    forecast_dates = generate_forecast_dates(total_revenue_by_date, periods)

    for i, f in enumerate(revenue_forecast_result["forecast"]):
        f["date_label"] = forecast_dates[i] if i < len(forecast_dates) else f"W+{f['period']}"

    # Historical for chart
    revenue_historical = [
        {"date": str(row["date"].date()), "value": row["revenue"]}
        for _, row in total_revenue_by_date.iterrows()
    ]

    # ── 2. Category Rankings ────────────────────────────────────────────────
    category_rankings = forecast_by_category(df, periods, value_col=main_col)

    # ── 3. Region Signals ───────────────────────────────────────────────────
    region_signals = analyze_regions(df, value_col=main_col)

    # ── 4. Data Preview ─────────────────────────────────────────────────────
    preview_cols = ["date"] + [c for c in ["product_category", "region", "revenue", "profit", "units_sold"] if c in df.columns]
    preview_rows = df[preview_cols].head(5).copy()
    preview_rows["date"] = preview_rows["date"].dt.strftime("%Y-%m-%d")
    preview = preview_rows.to_dict(orient="records")

    # ── 5. AI One-Liner Summary ─────────────────────────────────────────────
    ai_summary = explain_insights(
        revenue_forecast_result["forecast"],
        category_rankings,
        region_signals
    )

    return {
        # Revenue forecast
        "revenue_forecast": revenue_forecast_result["forecast"],
        "revenue_historical": revenue_historical,
        "revenue_anomalies": revenue_anomalies,
        "model_used": revenue_forecast_result["model_used"],
        "seasonality_period": revenue_forecast_result["seasonality_period"],
        "baseline": baseline,
        "confidence": confidence,

        # Category insights
        "category_rankings": category_rankings,

        # Region insights
        "region_signals": region_signals,

        # Meta
        "ai_summary": ai_summary,
        "row_count": len(df),
        "preview": preview,
        "periods": periods,

        # Detected columns
        "has_categories": "product_category" in df.columns,
        "has_regions": "region" in df.columns,
        "categories": df["product_category"].unique().tolist() if "product_category" in df.columns else [],
        "regions": df["region"].unique().tolist() if "region" in df.columns else [],
    }


@app.post("/scenario")
async def scenario(
    file: UploadFile = File(...),
    adjustment_pct: float = 10.0,
    periods: int = 4,
    column: str = "revenue"
):
    contents = await file.read()

    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")

    numeric_cols = [col for col in df.columns if col != "date" and pd.api.types.is_numeric_dtype(df[col])]
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found.")

    if column not in df.columns:
        column = numeric_cols[0]

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df = clean_numeric_columns(df)

    # If multi-dimensional dataset, aggregate revenue by date first
    if "product_category" in df.columns or "region" in df.columns:
        agg = df.groupby("date")[column].sum().reset_index()
        values = agg[column].tolist()
    else:
        values = df[column].tolist()

    result = run_scenario(values, adjustment_pct, periods)
    ai_summary = explain_scenario(result["baseline_forecast"], result["scenario_forecast"], adjustment_pct)

    return {**result, "ai_summary": ai_summary}


@app.post("/chat")
async def chat(
    file: UploadFile = File(...),
    question: str = Form(...),
    column: str = "revenue"
):
    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No date column found.")

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df = clean_numeric_columns(df)

    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    schema = detect_schema(df)

    try:
        from src.backend.explainer import parse_user_question
        parsed = parse_user_question(question, numeric_cols, schema)
        print(f"DEBUG parsed: {parsed}", flush=True, file=sys.stderr)
        col = parsed.get("column", column)
        periods = parsed.get("periods", 4)
        intent = parsed.get("intent", "both")
        filters = parsed.get("filters", {})
        if col not in df.columns:
            col = column if column in df.columns else numeric_cols[0]
    except Exception as e:
        print(f"PARSE ERROR: {e}", flush=True)
        col = column if column in df.columns else numeric_cols[0]
        periods = 4
        intent = "both"
        filters = {}

    # Apply filters
    filtered_df = df.copy()
    filter_description = []
    for filter_col, filter_val in filters.items():
        if filter_col in filtered_df.columns:
            filtered_df = filtered_df[filtered_df[filter_col].astype(str).str.lower() == str(filter_val).lower()]
            filter_description.append(f"{filter_col}: {filter_val}")

    if len(filtered_df) < 4:
        raise HTTPException(status_code=400, detail=f"Not enough data after filtering ({len(filtered_df)} rows).")

    agg = filtered_df.groupby("date")[col].sum().reset_index()
    values = agg[col].tolist()

    forecast_result = run_forecast(values, periods)
    anomalies = detect_anomalies(values)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods
    confidence = compute_confidence(values, forecast_result)
    forecast_dates = generate_forecast_dates(agg, periods)

    for i, f in enumerate(forecast_result["forecast"]):
        f["date_label"] = forecast_dates[i] if i < len(forecast_dates) else f"W+{f['period']}"

    filter_label = " · ".join(filter_description) if filter_description else None
    ai_summary = explain_forecast(forecast_result["forecast"], anomalies, baseline, intent=intent, question=question)

    preview_rows = df.head(5).copy()
    preview_rows["date"] = preview_rows["date"].dt.strftime("%Y-%m-%d")

    return {
        "question": question,
        "column": col,
        "periods": periods,
        "intent": intent,
        "filters_applied": filters,
        "filter_label": filter_label,
        "forecast": forecast_result["forecast"],
        "historical": [{"date": str(row["date"].date()), "value": row[col]} for _, row in agg.iterrows()],
        "anomalies": anomalies,
        "baseline": baseline,
        "ai_summary": ai_summary,
        "confidence": confidence,
        "model_used": forecast_result["model_used"],
        "numeric_columns": numeric_cols,
        "schema": schema,
        "row_count": len(filtered_df),
        "preview": preview_rows.to_dict(orient="records")
    }
