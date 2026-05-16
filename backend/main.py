from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from models import User, Case
from auth import hash_password, verify_password, create_access_token, decode_token
from mock_model import run_mock_inference, run_demo_inference
import random, string
from datetime import datetime, timezone

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OPG Vision API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/dicom"}
MAX_SIZE_BYTES = 10 * 1024 * 1024
PLAN_LIMITS = {"free": 10, "pro": 200, "enterprise": None}


def generate_report_id() -> str:
    today = datetime.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"OPG-{today}-{suffix}"


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError
        payload = decode_token(token)
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user:
            raise ValueError
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")


# ─── Health ───────────────────────────────────────────────

@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok", "service": "OPG Vision API", "version": "2.0"}


# ─── Auth ─────────────────────────────────────────────────

@app.post("/auth/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if db.query(User).filter(User.email == email.lower().strip()).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=name.strip(),
        email=email.lower().strip(),
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "plan": user.plan},
    }


@app.post("/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "plan": user.plan},
    }


@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_cases = db.query(Case).filter(Case.user_id == current_user.id).count()
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan,
        "analyses_this_month": current_user.analyses_this_month,
        "total_cases": total_cases,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


# ─── Cases ────────────────────────────────────────────────

@app.get("/api/cases")
def list_cases(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cases = (
        db.query(Case)
        .filter(Case.user_id == current_user.id)
        .order_by(Case.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "report_id": c.report_id,
            "case_id": c.case_id,
            "reference_no": c.reference_no,
            "officer_name": c.officer_name,
            "gender": c.gender,
            "estimated_age": c.estimated_age,
            "classification": c.classification,
            "is_borderline": c.is_borderline,
            "timestamp": c.timestamp,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cases
    ]


@app.post("/api/analyse")
async def analyse(
    image: UploadFile = File(...),
    case_id: str = Form(...),
    reference_no: str = Form(...),
    officer_name: str = Form(...),
    gender: str = Form(...),
    notes: str = Form(""),
    demo: str = Form("false"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = PLAN_LIMITS.get(current_user.plan)
    if limit is not None and current_user.analyses_this_month >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly limit of {limit} analyses reached on your {current_user.plan.title()} plan. Please upgrade to continue.",
        )

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPG, PNG, or DCM file.")

    contents = await image.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    result = run_demo_inference() if demo.lower() == "true" else run_mock_inference(contents, gender)
    report_id = generate_report_id()

    case = Case(
        user_id=current_user.id,
        report_id=report_id,
        case_id=case_id,
        reference_no=reference_no,
        officer_name=officer_name,
        gender=gender,
        notes=notes,
        estimated_age=result["estimated_age"],
        confidence_margin=result["confidence_margin"],
        age_lower=result["age_lower"],
        age_upper=result["age_upper"],
        classification=result["classification"],
        classification_confidence=result["classification_confidence"],
        is_borderline=result["is_borderline"],
        model_version=result["model_version"],
        timestamp=result["timestamp"],
    )
    db.add(case)
    current_user.analyses_this_month += 1
    db.commit()

    return {
        "report_id": report_id,
        "case_id": case_id,
        "reference_no": reference_no,
        "officer_name": officer_name,
        "gender": gender,
        "notes": notes,
        **result,
    }
