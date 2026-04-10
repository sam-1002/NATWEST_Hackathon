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
async def forecast(file: UploadFile = File(...), periods: int = 4):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")), parse_dates=["date"])
    df = df.sort_values("date").reset_index(drop=True)
    values = df["value"].tolist()

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
        "historical": [
            {"date": str(row["date"].date()), "value": row["value"]}
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