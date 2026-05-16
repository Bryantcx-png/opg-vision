import random, time
from datetime import datetime, timezone


def run_mock_inference(image_bytes: bytes, gender: str) -> dict:
    time.sleep(random.uniform(1.5, 3.0))

    base_age = round(random.uniform(14.0, 55.0), 1)
    confidence = round(random.uniform(1.5, 2.8), 1)
    lower = round(base_age - confidence, 1)
    upper = round(base_age + confidence, 1)

    if base_age < 17.0:
        classification, is_borderline, warning = "MINOR", False, None
    elif base_age <= 19.0:
        classification, is_borderline = "BORDERLINE", True
        warning = (
            "Age estimate is within margin of error of the legal threshold (18 years). "
            "Manual specialist review is strongly recommended before legal proceedings."
        )
    else:
        classification, is_borderline, warning = "ADULT", False, None

    confidence_level = "High" if confidence < 2.0 else "Medium" if confidence < 2.5 else "Low"

    return {
        "estimated_age": base_age,
        "confidence_margin": confidence,
        "age_lower": lower,
        "age_upper": upper,
        "classification": classification,
        "classification_confidence": confidence_level,
        "is_borderline": is_borderline,
        "borderline_warning": warning,
        "processing_time_ms": int(random.uniform(1500, 3000)),
        "model_version": "ResNeXt-50 v1.0 (mock)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run_demo_inference() -> dict:
    """Always returns a BORDERLINE result for pitch demos."""
    return {
        "estimated_age": 16.8,
        "confidence_margin": 1.9,
        "age_lower": 14.9,
        "age_upper": 18.7,
        "classification": "BORDERLINE",
        "classification_confidence": "Medium",
        "is_borderline": True,
        "borderline_warning": (
            "Age estimate is within margin of error of the legal threshold (18 years). "
            "Manual specialist review is strongly recommended before legal proceedings."
        ),
        "processing_time_ms": 2134,
        "model_version": "ResNeXt-50 v1.0 (mock)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
