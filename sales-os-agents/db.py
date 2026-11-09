"""Async SQLite-backed persistence for the Sales OS agent pipeline."""
from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

from config import settings
from models import Lead, Quote, StateTransition


def _db_path() -> str:
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return url


class Database:
    def __init__(self, path: Optional[str] = None):
        self.path = path or _db_path()
        self._lock = asyncio.Lock()
        self._conn: Optional[sqlite3.Connection] = None

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)

    def _init_sync(self) -> None:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS state_transitions (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quotes (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                lead_id TEXT,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
        conn.close()

    async def _run(self, fn, *args, **kwargs):
        async with self._lock:
            return await asyncio.to_thread(fn, *args, **kwargs)

    def _conn_sync(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    async def upsert_lead(self, lead: Lead) -> None:
        def _sync():
            conn = self._conn_sync()
            conn.execute(
                "INSERT INTO leads (id, data, status, updated_at) VALUES (?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, updated_at=excluded.updated_at",
                (lead.id, lead.model_dump_json(), lead.status.value, lead.updated_at.isoformat()),
            )
            conn.commit()
            conn.close()

        await self._run(_sync)

    async def get_lead(self, lead_id: str) -> Optional[Lead]:
        def _sync():
            conn = self._conn_sync()
            row = conn.execute("SELECT data FROM leads WHERE id=?", (lead_id,)).fetchone()
            conn.close()
            return Lead.model_validate_json(row["data"]) if row else None

        return await self._run(_sync)

    async def list_leads_by_status(self, status: str, limit: int = 100) -> List[Lead]:
        def _sync():
            conn = self._conn_sync()
            rows = conn.execute(
                "SELECT data FROM leads WHERE status=? ORDER BY updated_at ASC LIMIT ?",
                (status, limit),
            ).fetchall()
            conn.close()
            return [Lead.model_validate_json(r["data"]) for r in rows]

        return await self._run(_sync)

    async def claim_leads(self, status: str, limit: int = 25) -> List[Lead]:
        def _sync():
            conn = self._conn_sync()
            rows = conn.execute(
                "SELECT id FROM leads WHERE status=? ORDER BY updated_at ASC LIMIT ?",
                (status, limit),
            ).fetchall()
            ids = [r["id"] for r in rows]
            conn.close()
            return ids

        ids = await self._run(_sync)
        leads = []
        for lid in ids:
            lead = await self.get_lead(lid)
            if lead:
                leads.append(lead)
        return leads

    async def delete_lead(self, lead_id: str) -> None:
        def _sync():
            conn = self._conn_sync()
            conn.execute("DELETE FROM leads WHERE id=?", (lead_id,))
            conn.commit()
            conn.close()

        await self._run(_sync)

    async def add_transition(self, transition: StateTransition) -> None:
        def _sync():
            conn = self._conn_sync()
            conn.execute(
                "INSERT INTO state_transitions (id, lead_id, data, created_at) VALUES (?,?,?,?)",
                (transition.id, transition.lead_id, transition.model_dump_json(), transition.created_at.isoformat()),
            )
            conn.commit()
            conn.close()

        await self._run(_sync)

    async def add_quote(self, quote: Quote) -> None:
        def _sync():
            conn = self._conn_sync()
            conn.execute(
                "INSERT INTO quotes (id, lead_id, data, created_at) VALUES (?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET data=excluded.data, lead_id=excluded.lead_id",
                (quote.id, quote.lead_id, quote.model_dump_json(), quote.created_at.isoformat()),
            )
            conn.commit()
            conn.close()

        await self._run(_sync)

    async def get_quote(self, quote_id: str) -> Optional[Quote]:
        def _sync():
            conn = self._conn_sync()
            row = conn.execute("SELECT data FROM quotes WHERE id=?", (quote_id,)).fetchone()
            conn.close()
            return Quote.model_validate_json(row["data"]) if row else None

        return await self._run(_sync)

    async def list_quotes_by_lead(self, lead_id: str) -> List[Quote]:
        def _sync():
            conn = self._conn_sync()
            rows = conn.execute("SELECT data FROM quotes WHERE lead_id=?", (lead_id,)).fetchall()
            conn.close()
            return [Quote.model_validate_json(r["data"]) for r in rows]

        return await self._run(_sync)

    async def log_event(self, lead_id: Optional[str], event_type: str, payload: Any) -> None:
        import uuid as _u

        def _sync():
            conn = self._conn_sync()
            conn.execute(
                "INSERT INTO events (id, lead_id, event_type, payload, created_at) VALUES (?,?,?,?,?)",
                (_u.uuid4().hex, lead_id, event_type, json.dumps(payload), datetime.now().isoformat()),
            )
            conn.commit()
            conn.close()

        await self._run(_sync)
