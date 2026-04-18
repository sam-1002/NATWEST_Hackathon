import pandas as pd
import numpy as np
from fastapi import HTTPException

# ── Column name synonyms ──────────────────────────────────────────────────────

CATEGORY_SYNONYMS = [
    "product_category", "Product_Category", "PRODUCT_CATEGORY",
    "category", "Category", "CATEGORY",
    "product_type", "Product_Type", "productcategory",
    "item_category", "Item_Category", "product_group",
    "Product_Group", "segment", "Segment", "dept", "Department"
]

REGION_SYNONYMS = [
    "region", "Region", "REGION",
    "area", "Area", "AREA",
    "zone", "Zone", "ZONE",
    "location", "Location", "LOCATION",
    "territory", "Territory", "branch",
    "Branch", "city", "City", "state", "State",
    "store", "Store", "market", "Market"
]

DATE_SYNONYMS = [
    "date", "Date", "DATE",
    "week", "Week", "WEEK",
    "week_start", "week_ending", "week_end",
    "transaction_date", "transaction_Date",
    "order_date", "order_Date",
    "sale_date", "sales_date",
    "period", "Period",
    "time", "Time",
    "timestamp", "Timestamp",
    "report_date", "reporting_date",
    "invoice_date",
    "day", "Day"
]


def standardise_date_column(df: pd.DataFrame) -> pd.DataFrame:
    """Detect and rename date column synonym to 'date'."""
    if "date" in df.columns:
        return df

    for synonym in DATE_SYNONYMS:
        if synonym in df.columns:
            df = df.rename(columns={synonym: "date"})
            return df

    for col in df.columns:
        if col.lower() in [s.lower() for s in DATE_SYNONYMS]:
            df = df.rename(columns={col: "date"})
            return df

    for col in df.columns:
        if df[col].dtype == object:
            try:
                parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
                if parsed.notna().sum() / len(df) > 0.8:
                    df = df.rename(columns={col: "date"})
                    return df
            except Exception:
                continue

    raise HTTPException(
        status_code=400,
        detail=f"No date column found. Expected one of: date, week, order_date, "
               f"transaction_date, period, timestamp. Found columns: {list(df.columns)}"
    )


def standardise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename category and region synonyms to standard names."""
    for col in df.columns:
        if col in CATEGORY_SYNONYMS and col != "product_category":
            df = df.rename(columns={col: "product_category"})
            break
        # case-insensitive fallback
        if col.lower() in [s.lower() for s in CATEGORY_SYNONYMS] and col != "product_category":
            df = df.rename(columns={col: "product_category"})
            break

    for col in df.columns:
        if col in REGION_SYNONYMS and col != "region":
            df = df.rename(columns={col: "region"})
            break
        if col.lower() in [s.lower() for s in REGION_SYNONYMS] and col != "region":
            df = df.rename(columns={col: "region"})
            break

    return df


# ── Main preprocessor ─────────────────────────────────────────────────────────

def preprocess(df: pd.DataFrame, numeric_cols: list) -> dict:
    """
    Full preprocessing pipeline. Returns:
    {
        "df": cleaned DataFrame,
        "warnings": [...],          # non-fatal issues found and fixed
        "outlier_info": {...},      # outlier details if found — caller decides
    }
    """
    warnings = []
    outlier_info = {}

    # 0. Standardise date column name — must happen first
    df = standardise_date_column(df)

    # 1. Standardise category and region column names
    df = standardise_columns(df)

    # 2. Sort by date
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"], infer_datetime_format=True, errors="coerce")
        nat_count = df["date"].isna().sum()
        if nat_count > 0:
            warnings.append(
                f"{nat_count} rows had unparseable date values and were dropped."
            )
            df = df.dropna(subset=["date"])

    df = df.sort_values("date").reset_index(drop=True)

    # 3. Missing values
    for col in numeric_cols:
        if col not in df.columns:
            continue
        missing = df[col].isna().sum()
        if missing > 0:
            pct = round(missing / len(df) * 100, 1)
            if pct > 40:
                warnings.append(
                    f"'{col}' has {missing} missing values ({pct}%) — too many to reliably fill. "
                    f"Forecast for this column may be unreliable."
                )
            # Forward fill then backward fill then zero
            df[col] = df[col].fillna(method="ffill").fillna(method="bfill").fillna(0)
            warnings.append(
                f"'{col}': {missing} missing value{'s' if missing > 1 else ''} ({pct}%) "
                f"filled using forward-fill."
            )

    # 4. Duplicate dates — aggregate by summing numeric cols
    if df.duplicated(subset=["date"]).any():
        dup_count = df.duplicated(subset=["date"]).sum()
        agg_dict = {col: "sum" for col in numeric_cols if col in df.columns}
        # Keep first value for categorical cols
        cat_cols = [c for c in df.columns if c not in numeric_cols and c != "date"]
        for c in cat_cols:
            agg_dict[c] = "first"
        df = df.groupby("date").agg(agg_dict).reset_index()
        df = df.sort_values("date").reset_index(drop=True)
        warnings.append(
            f"{dup_count} duplicate date{'s' if dup_count > 1 else ''} found — "
            f"numeric values aggregated by summing."
        )

    # 5. Negative values in non-negative columns
    non_negative_cols = [
        c for c in numeric_cols
        if any(x in c.lower() for x in [
            "revenue", "profit", "sales", "units", "orders",
            "customers", "spend", "cost", "inventory", "returns"
        ])
    ]
    for col in non_negative_cols:
        if col not in df.columns:
            continue
        neg_count = (df[col] < 0).sum()
        if neg_count > 0:
            df[col] = df[col].clip(lower=0)
            warnings.append(
                f"'{col}': {neg_count} negative value{'s' if neg_count > 1 else ''} found "
                f"and clipped to 0."
            )

    # 6. Zero value check
    for col in numeric_cols:
        if col not in df.columns:
            continue
        zero_pct = (df[col] == 0).sum() / len(df) * 100
        if zero_pct > 20:
            warnings.append(
                f"'{col}': {round(zero_pct, 1)}% of values are zero — "
                f"forecast may be unreliable. These likely represent days with no activity."
            )

    # 7. Extreme outlier detection (IQR method) — flag only, don't remove
    for col in numeric_cols:
        if col not in df.columns:
            continue
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 3 * iqr
        upper = q3 + 3 * iqr
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        outlier_count = outlier_mask.sum()
        if outlier_count > 0:
            outlier_vals = df.loc[outlier_mask, ["date", col]].copy()
            outlier_vals["date"] = outlier_vals["date"].astype(str)
            outlier_info[col] = {
                "count": int(outlier_count),
                "indices": df.index[outlier_mask].tolist(),
                "values": outlier_vals.to_dict(orient="records"),
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2),
            }

    return {
        "df": df,
        "warnings": warnings,
        "outlier_info": outlier_info,
    }


def remove_outliers(df: pd.DataFrame, outlier_info: dict, cols_to_clean: list) -> pd.DataFrame:
    """
    Called only if user confirms they want outliers removed.
    Replaces outlier values with column median.
    """
    for col in cols_to_clean:
        if col not in outlier_info or col not in df.columns:
            continue
        indices = outlier_info[col]["indices"]
        median_val = df[col].median()
        df.loc[indices, col] = median_val
    return df