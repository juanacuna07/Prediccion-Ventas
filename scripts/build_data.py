"""Convierte las salidas del notebook (notebook_outputs/) en JSON ligeros para la web.

Uso:  python scripts/build_data.py
Requiere: pandas, numpy
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "notebook_outputs"
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

BUNDLE = {}

def dump(name, obj):
    """Acumula cada bloque; al final se escribe data/data.js (funciona sin servidor)."""
    BUNDLE[name.replace(".json", "")] = obj

# --- Validación (15-30 jul 2017): real vs predicho -------------------------
val = pd.read_csv(SRC / "validation_predictions.csv", parse_dates=["date"])
stores = sorted(val.store_nbr.unique().tolist())
families = sorted(val.family.unique().tolist())
dates_val = sorted(val.date.dt.strftime("%Y-%m-%d").unique().tolist())
val["s"] = val.store_nbr.map({s: i for i, s in enumerate(stores)})
val["f"] = val.family.map({f: i for i, f in enumerate(families)})
val["d"] = val.date.dt.strftime("%Y-%m-%d").map({d: i for i, d in enumerate(dates_val)})
n_series, n_days = len(stores) * len(families), len(dates_val)

def pivot(col):
    arr = np.zeros((n_series, n_days))
    arr[val.s * len(families) + val.f, val.d] = val[col].clip(lower=0)
    return np.round(arr, 2).tolist()

dump("validation.json", {
    "dates": dates_val,
    "actual": pivot("target"),
    "lightgbm": pivot("pred_lightgbm"),
    "tweedie": pivot("pred_tweedie"),
})

# --- Pronóstico final (16-31 ago 2017) -------------------------------------
# submission.csv solo trae (id, sales). El orden de test.csv de Kaggle es:
# fecha -> tienda (1..54) -> familia (orden alfabético), 1782 filas por día.
sub = pd.read_csv(SRC / "submission.csv").sort_values("id").reset_index(drop=True)
per_day = len(stores) * len(families)
assert len(sub) == per_day * 16, "El submission debe tener 16 días x 1782 series"
k = sub.id - sub.id.min()
day, idx = k // per_day, k % per_day          # idx = tienda*33 + familia
dates_fc = pd.date_range("2017-08-16", periods=16).strftime("%Y-%m-%d").tolist()
fc = np.zeros((per_day, 16))
fc[idx, day] = sub.sales.clip(lower=0)
dump("forecast.json", {
    "dates": dates_fc,
    "stores": stores,
    "families": families,
    "forecast": np.round(fc, 2).tolist(),
})

# --- Métricas, SHAP y metadatos --------------------------------------------
run = json.loads((SRC / "run_summary.json").read_text(encoding="utf-8"))
shap = pd.read_csv(SRC / "shap_feature_importance.csv").round(5)
opt = pd.read_csv(SRC / "optuna_trials.csv")
dump("metrics.json", {
    "models": run["validation_metrics"],
    "rolling": run["rolling_origin"],
    "shap": shap.to_dict("records"),
    "params": {k: v for k, v in run["best_optuna_params"].items()
               if k not in ("random_state", "n_jobs", "verbosity")},
    "best_iteration": run["lightgbm_best_iteration"],
    "n_features": len(run["features"]),
    "optuna": [{"n": int(r.number), "v": round(float(r.value), 5)} for r in opt.itertuples()],
})

# --- Salida: un solo archivo JS cargable con <script> (abre con doble clic) --
js = "window.FAVORITA = " + json.dumps(BUNDLE, ensure_ascii=False, separators=(",", ":")) + ";\n"
(OUT / "data.js").write_text(js, encoding="utf-8")
print(f"data/data.js escrito: {(OUT / 'data.js').stat().st_size/1024:.0f} KB")
