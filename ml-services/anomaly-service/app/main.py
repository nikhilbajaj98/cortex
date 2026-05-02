from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal, List
import time


app = FastAPI(title="Cortex ML Anomaly Service", version="0.1.0")


class PredictRequest(BaseModel):
    service: str = Field(..., min_length=1)
    # Align with Cortex semantics:
    # - p95_latency_ms: milliseconds
    # - error_rate: fraction 0..1
    p95_latency_ms: float = Field(..., ge=0)
    error_rate: float = Field(..., ge=0, le=1)


class PredictResponse(BaseModel):
    service: str
    risk: float = Field(..., ge=0, le=1)
    label: Literal["normal", "warning", "critical"]
    reasons: List[str]
    model: str
    timestamp_ms: int


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # Minimal deterministic heuristic model for Phase 3.
    # Keeps interface stable so we can replace with real ML later.
    reasons: List[str] = []
    risk = 0.0

    if req.error_rate >= 0.2:
        risk = max(risk, 0.95)
        reasons.append(f"error_rate>=0.2 ({req.error_rate:.3f})")
    elif req.error_rate >= 0.1:
        risk = max(risk, 0.8)
        reasons.append(f"error_rate>=0.1 ({req.error_rate:.3f})")
    elif req.error_rate >= 0.03:
        risk = max(risk, 0.5)
        reasons.append(f"error_rate>=0.03 ({req.error_rate:.3f})")

    if req.p95_latency_ms >= 800:
        risk = max(risk, 0.85)
        reasons.append(f"p95_latency_ms>=800 ({req.p95_latency_ms:.0f})")
    elif req.p95_latency_ms >= 400:
        risk = max(risk, 0.6)
        reasons.append(f"p95_latency_ms>=400 ({req.p95_latency_ms:.0f})")
    elif req.p95_latency_ms >= 250:
        risk = max(risk, 0.4)
        reasons.append(f"p95_latency_ms>=250 ({req.p95_latency_ms:.0f})")

    if risk >= 0.85:
        label = "critical"
    elif risk >= 0.55:
        label = "warning"
    else:
        label = "normal"

    if not reasons:
        reasons = ["metrics within heuristic thresholds"]

    return PredictResponse(
        service=req.service,
        risk=risk,
        label=label,
        reasons=reasons,
        model="heuristic:v0",
        timestamp_ms=int(time.time() * 1000),
    )

