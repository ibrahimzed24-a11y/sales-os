"""Agent 4: Scope & Proposal Engine."""
from __future__ import annotations

import httpx

from agents.base_agent import BaseAgent
from config import settings
from models import Lead, LeadStatus, Quote, QuoteLineItem

WEBSITE_LAUNCH = QuoteLineItem(
    description="VALIOZ Health Custom Website Launch (Mobile-first, SEO, GEO, AI Visibility, 8 Social Designs, 6 Short-form Videos)",
    amount_cad=499.0,
)
GROWTH_AGENT = QuoteLineItem(
    description="AI Growth Agent Service (Daily Growth Brief, Keyword Tracking) — included for first 30 days",
    amount_cad=0.0,
)
RETAINER = QuoteLineItem(
    description="Optional Ongoing Retainer",
    amount_cad=299.0,
    recurring=True,
)


class AgentProposal(BaseAgent):
    name = "agent_proposal"
    consumes = LeadStatus.QUALIFIED_DEAL.value
    produces = LeadStatus.INVOICE_SENT.value

    def __init__(self, db, dry_run=False, sender=None):
        super().__init__(db, dry_run=dry_run)
        self.sender = sender

    async def _checkout_url(self, quote: Quote, lead: Lead) -> str:
        if not settings.stripe_secret_key:
            return f"https://checkout.stripe.com/mock/{quote.id}"
        try:
            async with httpx.AsyncClient(timeout=30.0, auth=(settings.stripe_secret_key, "")) as client:
                resp = await client.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    data={
                        "mode": "payment",
                        "success_url": settings.stripe_success_url,
                        "cancel_url": settings.stripe_cancel_url,
                        "line_items[0][price_data][currency]": "cad",
                        "line_items[0][price_data][product_data][name]": WEBSITE_LAUNCH.description,
                        "line_items[0][price_data][unit_amount]": "49900",
                        "line_items[0][quantity]": "1",
                        "metadata[quote_id]": quote.id,
                        "metadata[lead_id]": lead.id,
                    },
                )
            if resp.status_code < 300:
                return resp.json().get("url", f"https://checkout.stripe.com/mock/{quote.id}")
        except Exception:  # noqa: BLE001
            pass
        return f"https://checkout.stripe.com/mock/{quote.id}"

    async def create_proposal(self, lead: Lead) -> Quote:
        quote = Quote(
            lead_id=lead.id,
            line_items=[WEBSITE_LAUNCH, GROWTH_AGENT, RETAINER],
            total_one_time_cad=499.0,
            recurring_monthly_cad=299.0,
        )
        quote.checkout_url = await self._checkout_url(quote, lead)
        await self.db.add_quote(quote)
        return quote

    async def process(self, lead: Lead) -> None:
        quote = await self.create_proposal(lead)
        lead.metadata["quote_id"] = quote.id
        lead.metadata["checkout_url"] = quote.checkout_url
        html = (
            f"<p>Hi,</p><p>Thanks for your interest. Here is your proposal for {lead.clinic_name}:</p>"
            f"<ul><li>{WEBSITE_LAUNCH.description} — $499 CAD (one-time)</li>"
            f"<li>{GROWTH_AGENT.description} — included (30 days)</li>"
            f"<li>{RETAINER.description} — $299 CAD/month (optional after day 30)</li></ul>"
            f'<p><a href="{quote.checkout_url}">Complete your order</a></p>'
            f"<p>The website stays yours. Domain and hosting are purchased in your own accounts.</p>"
        )
        if self.sender and not self.dry_run:
            await self.sender.send(lead.email, f"Your VALIOZ Health proposal — {lead.clinic_name}", html)
        await self.handover(lead, LeadStatus.INVOICE_SENT.value, f"proposal {quote.id} sent")

    async def confirm_payment(self, quote_id: str) -> bool:
        quote = await self.db.get_quote(quote_id)
        if quote is None:
            return False
        quote.status = "paid"
        await self.db.add_quote(quote)
        lead = await self.db.get_lead(quote.lead_id)
        if lead is None:
            return False
        await self.handover(lead, LeadStatus.DEAL_WON.value, f"payment confirmed for {quote_id}")
        return True
