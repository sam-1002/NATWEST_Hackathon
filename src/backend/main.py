from fastapi import Form
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from src.backend.models import run_forecast, detect_anomalies
from src.backend.scenario import run_scenario
from src.backend.explainer import explain_forecast, explain_scenario
import pandas as pd
import io

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

@app.post("/forecast")
async def forecast(file: UploadFile = File(...), periods: int = 4, column: str = "value"):
    
    # file type validation
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file only. PDF, images and other formats are not supported."
        )
    
    contents = await file.read()
    
    # try to parse it
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this file. Make sure it is a valid CSV file."
        )
    
    # check date column exists
    if "date" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="No 'date' column found. Please make sure your CSV has a column named 'date'."
        )
    
    # detect numeric columns
    numeric_cols = [col for col in df.columns if col != "date" and pd.api.types.is_numeric_dtype(df[col])]
    
    if not numeric_cols:
        raise HTTPException(
            status_code=400,
            detail="No numeric columns found in your CSV. Please check your data."
        )
    
    # check minimum data points
    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(df)} data points found. Please provide at least 10 data points for a reliable forecast."
        )
    
    # use requested column or default to first numeric column
    if column not in df.columns:
        column = numeric_cols[0]
    
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    values = df[column].tolist()

    forecast_result = run_forecast(values, periods)
    anomalies = detect_anomalies(values)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods

    ai_summary = explain_forecast(
        forecast_result["forecast"],
        anomalies,
        baseline
    )

    return {
        "forecast": forecast_result["forecast"],
        "model_used": forecast_result["model_used"],
        "seasonality_period": forecast_result["seasonality_period"],
        "anomalies": anomalies,
        "baseline": baseline,
        "ai_summary": ai_summary,
        "numeric_columns": numeric_cols,
        "selected_column": column,
        "row_count": len(df),
        "historical": [
            {"date": str(row["date"].date()), "value": row[column]}
            for _, row in df.iterrows()
        ]
    }

@app.post("/scenario")
async def scenario(file: UploadFile = File(...), adjustment_pct: float = 10.0, periods: int = 4):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")), parse_dates=["date"])
    df = df.sort_values("date").reset_index(drop=True)
    values = df["value"].tolist()

    result = run_scenario(values, adjustment_pct, periods)

    ai_summary = explain_scenario(
        result["baseline_forecast"],
        result["scenario_forecast"],
        adjustment_pct
    )

    return {
        **result,
        "ai_summary": ai_summary
    }
@app.post("/chat")
async def chat(
    file: UploadFile = File(...),
    question: str = Form(...)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file.")

    if "date" not in df.columns:
        raise HTTPException(status_code=400, detail="No 'date' column found.")

    numeric_cols = [col for col in df.columns if col != "date" and pd.api.types.is_numeric_dtype(df[col])]

    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns found.")

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    from src.backend.explainer import parse_user_question
    try:
        parsed = parse_user_question(question, numeric_cols)
        column = parsed.get("column", numeric_cols[0])
        periods = parsed.get("periods", 4)
        intent = parsed.get("intent", "both")
        if column not in df.columns:
            column = numeric_cols[0]
    except:
        column = numeric_cols[0]
        periods = 4
        intent = "both"

    values = df[column].tolist()
    forecast_result = run_forecast(values, periods)
    anomalies = detect_anomalies(values)
    baseline = [round(sum(values[-4:]) / 4, 2)] * periods

    ai_summary = explain_forecast(
    forecast_result["forecast"],
    anomalies,
    baseline,
    intent=intent,
    question=question
)

    return {
        "question": question,
        "understood_as": f"Forecasting '{column}' for next {periods} weeks",
        "column": column,
        "periods": periods,
        "intent": intent,
        "forecast": forecast_result["forecast"],
        "model_used": forecast_result["model_used"],
        "seasonality_period": forecast_result["seasonality_period"],
        "anomalies": anomalies,
        "baseline": baseline,
        "ai_summary": ai_summary,
        "numeric_columns": numeric_cols,
        "selected_column": column,
        "row_count": len(df),
        "historical": [
            {"date": str(row["date"].date()), "value": row[column]}
            for _, row in df.iterrows()
        ]
    }