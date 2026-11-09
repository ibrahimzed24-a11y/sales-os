"""Pydantic models and DB schemas for the Sales OS agent pipeline."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field


class LeadStatus(str, enum.Enum):
    SCRAPED_RAW = "SCRAPED_RAW"
    LEAD_VERIFIED_PRIORITY_A = "LEAD_VERIFIED_PRIORITY_A"
    REJECTED_DSO = "REJECTED_DSO"
    HOLD_SITE_DOWN = "HOLD_SITE_DOWN"
    CAMPAIGN_DISPATCHED = "CAMPAIGN_DISPATCHED"
    SUPPRESSED_CASL = "SUPPRESSED_CASL"
    QUALIFIED_DEAL = "QUALIFIED_DEAL"
    INVOICE_SENT = "INVOICE_SENT"
    DEAL_WON = "DEAL_WON"
    ACTIVE_ONBOARDING = "ACTIVE_ONBOARDING"
    RETAINER_COMMITTED = "RETAINER_COMMITTED"


class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    clinic_name: str
    city: str = ""
    province: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    parent_dso: str = ""
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    cdcp_participating: bool = False
    score: Optional[int] = None
    tier: str = ""
    evidence_hook: str = ""
    keyword_hook: str = ""
    offer_line: str = ""
    status: LeadStatus = LeadStatus.SCRAPED_RAW
    website_state: str = "unknown"  # live | broken | unknown
    website_opportunity: bool = False
    booking_engine: str = ""
    principal_dentist: str = ""
    office_manager: str = ""
    unsubscribed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class StateTransition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    from_status: Optional[LeadStatus] = None
    to_status: LeadStatus
    agent: str
    reason: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuoteLineItem(BaseModel):
    description: str
    amount_cad: float
    currency: str = "CAD"
    recurring: bool = False


class Quote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    line_items: list[QuoteLineItem] = Field(default_factory=list)
    total_one_time_cad: float = 0.0
    recurring_monthly_cad: float = 0.0
    checkout_url: str = ""
    status: str = "draft"  # draft | sent | paid | cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InboundReply(BaseModel):
    lead_id: str
    from_email: str
    subject: str = ""
    body: str
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TriageIntent(str, enum.Enum):
    POSITIVE_INTEREST = "POSITIVE_INTEREST"
    PMS_INQUIRY = "PMS_INQUIRY"
    OBJECTION_PRICING = "OBJECTION_PRICING"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    OTHER = "OTHER"


class TriageResult(BaseModel):
    intent: TriageIntent
    confidence: float = 0.0
    summary: str = ""
    pms_name: str = ""


class OnboardingTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    task: str
    completed: bool = False
    due_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
