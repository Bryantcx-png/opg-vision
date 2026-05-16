from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    plan = Column(String(20), default="free")           # free | pro | enterprise
    analyses_this_month = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_id = Column(String(30), nullable=False)
    case_id = Column(String(20), nullable=False)
    reference_no = Column(String(30), nullable=False)
    officer_name = Column(String(50), nullable=False)
    gender = Column(String(10), nullable=False)
    notes = Column(Text, default="")
    estimated_age = Column(Float)
    confidence_margin = Column(Float)
    age_lower = Column(Float)
    age_upper = Column(Float)
    classification = Column(String(20))
    classification_confidence = Column(String(10))
    is_borderline = Column(Boolean, default=False)
    model_version = Column(String(50))
    timestamp = Column(String(50))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="cases")
