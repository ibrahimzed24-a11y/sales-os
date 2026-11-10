#!/usr/bin/env python3
"""
Send due Valioz outreach emails through the already signed-in Hostinger tab.

Driven by browser-harness (the helpers js/switch_tab/... are pre-imported).
Reads every dist/outreach-queue/*/manifest.json, sends unsent entries whose UTC
time has arrived, and updates canadian_clinics_outreach_tracker.csv.

    browser-harness < scripts/send-outreach.py
    browser-harness < scripts/send-outreach.py --dry-run

Keep Chrome open and signed in to mail.hostinger.com. No SMTP credentials and
no Hostinger schedule-send subscription are used.
"""

import base64
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path.cwd()
QUEUE_DIR = ROOT / "dist" / "outreach-queue"
TRACKER = ROOT / "canadian_clinics_outreach_tracker.csv"
LOG = QUEUE_DIR / "send.log"
INBOX_URL = "https://mail.hostinger.com/0/mailboxes/INBOX"
DRY_RUN = os.environ.get("OUTREACH_DRY") == "1" or "--dry-run" in sys.argv
FORCE = os.environ.get("OUTREACH_FORCE") == "1"
MAX_PER_RUN = int(os.environ.get("OUTREACH_MAX", "10"))
WEAR_OFF = 6 * 3600


def log(message):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"{stamp} {message}"
    print(line, flush=True)
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def tracker_rows():
    if not TRACKER.exists():
        return [], []
    with open(TRACKER, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader), reader.fieldnames


def already_sent(clinic):
    rows, _ = tracker_rows()
    return any(
        row.get("Clinic Name") == clinic and row.get("Status") == "Sent" for row in rows
    )


def mark_sent(send, sent_at):
    rows, fields = tracker_rows()
    local = sent_at.astimezone(ZoneInfo(send["timeZone"]))
    stamp = (
        f"{sent_at.strftime('%Y-%m-%dT%H:%M:%SZ')} / "
        f"{local.strftime('%Y-%m-%d %H:%M')} {send['label']}"
    )
    for row in rows:
        if row.get("Clinic Name") != send["clinic"]:
            continue
        row["Status"] = "Sent"
        row["Sent Timestamp (UTC & Local)"] = stamp
        if "Sent via local Chrome scheduler" not in row.get("Notes", ""):
            row["Notes"] = f"{row.get('Notes', '')}; Sent via local Chrome scheduler".strip("; ")
    # In-place write: the runtime tracker is a hardlink into the repo, so a
    # temp-file replace would break the link. shortcut: no crash-safe temp write.
    with open(TRACKER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def click_text_button(label, tries=40):
    expr = (
        "(function(){var bs=document.querySelectorAll('button');"
        "for(var i=0;i<bs.length;i++){var b=bs[i];"
        f"var t=((b.innerText||'').trim());if(t==={json.dumps(label)}"
        f"||b.getAttribute('aria-label')==={json.dumps(label)})"
        "{b.click();return 'ok';}}return 'no';})()"
    )
    for _ in range(tries):
        if js(expr) == "ok":
            return True
        time.sleep(0.5)
    return False


def set_input(selector, value):
    expr = (
        "(function(){var e=document.querySelector(%s);if(!e)return 'no';"
        "var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
        "setter.call(e,%s);e.dispatchEvent(new Event('input',{bubbles:true}));"
        "e.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()"
        % (json.dumps(selector), json.dumps(value))
    )
    return js(expr) == "ok"


def commit_recipient(address):
    """Type the address, wait for Hostinger's resolver, then commit it as a chip.

    Pressing Enter before the suggestion resolves leaves the address as plain
    text and Send silently does nothing, so retry until the input clears.
    """
    set_input("#to", address)
    for attempt in range(4):
        js("(function(){var e=document.getElementById('to');if(e)e.focus();})()")
        time.sleep(3 if attempt == 0 else 1.5)
        press_key("Enter")
        time.sleep(1)
        if not js("document.getElementById('to').value"):
            return True
    return False


def inject_html(path):
    source = Path(path)
    if not source.is_absolute():
        source = ROOT / source
    payload = base64.b64encode(source.read_bytes()).decode()
    expr = (
        "(function(){var b64='%s';var bin=atob(b64);"
        "var bytes=new Uint8Array(bin.length);"
        "for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);"
        "var html=new TextDecoder('utf-8').decode(bytes);"
        "var fs=document.querySelectorAll('iframe');"
        "for(var j=0;j<fs.length;j++){var d=fs[j].contentDocument;"
        "var b=d&&d.querySelector('[data-qa=\"composer-content-body\"]');"
        "if(b){b.innerHTML=html;return 'injected';}}return 'no body';})()" % payload
    )
    return js(expr)


def composer_html():
    return js(
        "(function(){var found=null;document.querySelectorAll('iframe').forEach(function(f){"
        "var d=f.contentDocument;var b=d&&d.querySelector('[data-qa=\"composer-content-body\"]');"
        "if(b&&b.innerHTML.length>100)found=b;});return found?found.innerHTML:'';})()"
    )


def send_button_rect():
    return js(
        "(function(){var bs=document.querySelectorAll('button');"
        "for(var i=0;i<bs.length;i++){if((bs[i].innerText||'').trim()==='Send'){"
        "var r=bs[i].getBoundingClientRect();"
        "return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:bs[i].disabled};}}"
        "return null;})()"
    )


def close_and_discard():
    js("(function(){var b=document.querySelector('[data-qa=composer-close]');if(b){b.click();return 'ok';}return 'no';})()")
    time.sleep(1)
    js(
        "(function(){var d=Array.from(document.querySelectorAll('[role=dialog]'))"
        ".filter(function(x){return x.offsetParent!==null&&x.id!=='chatbot-static-box';})[0];"
        "if(!d)return 'no dialog';var bs=d.querySelectorAll('button');"
        "for(var i=0;i<bs.length;i++){if((bs[i].innerText||'').trim()==='Discard')"
        "{bs[i].click();return 'discarded';}}return 'no discard';})()"
    )


def open_hostinger():
    tabs = list_tabs()
    mail = [tab for tab in tabs if "mail.hostinger.com" in tab.get("url", "")]
    if not mail:
        raise RuntimeError("Hostinger tab is not open. Sign in at mail.hostinger.com.")
    switch_tab(mail[0]["target_id"])
    url = page_info()["url"]
    if "/mailboxes/INBOX" not in url or "/INBOX." in url:
        goto_url(INBOX_URL)
        wait_for_load()
    for _ in range(40):
        if js("!!document.querySelector('button')"):
            return
        time.sleep(0.5)
    raise RuntimeError("Hostinger UI did not render")


def send_one(send):
    log(f"send start {send['clinic']} -> {send['to']}")
    open_hostinger()
    if not click_text_button("New message"):
        raise RuntimeError("New message button not found")
    for _ in range(40):
        if js("!!document.getElementById('to') && !!document.getElementById('subject')"):
            break
        time.sleep(0.5)
    else:
        raise RuntimeError("composer inputs not found")

    if not commit_recipient(send["to"]):
        raise RuntimeError("recipient chip did not commit")

    set_input("#subject", send["subject"])
    if inject_html(send["htmlPath"]) != "injected":
        raise RuntimeError("composer body not found")
    time.sleep(1)

    html = composer_html()
    checks = {
        "body": len(html) > 5000,
        "clinic": send["clinic"].split("–")[0].strip().lower()[:18] in html.lower(),
        "unsubscribe": "health.valioz.com/unsubscribe" in html,
        "logo": "valioz-logo" in html,
        "recipient": not js("document.getElementById('to').value"),
    }
    if not all(checks.values()):
        raise RuntimeError(f"composer verification failed: {checks}")

    if DRY_RUN:
        close_and_discard()
        log(f"dry run ok {send['clinic']}")
        return True

    rect = send_button_rect()
    if not rect or rect.get("disabled"):
        raise RuntimeError("Send button unavailable")
    click_at_xy(rect["x"], rect["y"])

    for _ in range(40):
        time.sleep(0.5)
        if "Message sent successfully" in js("document.body.innerText"):
            mark_sent(send, datetime.now(timezone.utc))
            log(f"sent {send['clinic']}")
            time.sleep(2)
            return True

    tail = js("document.body.innerText.slice(-400)")
    raise RuntimeError(f"no send confirmation; page tail: {tail}")


def load_due():
    items = []
    for manifest in sorted(QUEUE_DIR.glob("*/manifest.json")):
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except Exception as exc:
            log(f"manifest read failed {manifest}: {exc}")
            continue
        for send in data.get("sends", []):
            if already_sent(send.get("clinic")):
                continue
            try:
                due = datetime.fromisoformat(send["utc"].replace("Z", "+00:00"))
            except Exception:
                log(f"bad utc for {send.get('clinic')}: {send.get('utc')}")
                continue
            items.append((due, send))
    items.sort(key=lambda pair: pair[0])
    return items


def main():
    log(f"runner start dry_run={DRY_RUN}")
    items = load_due()
    if not items:
        log("nothing due")
        return
    sent = 0
    for due, send in items:
        if sent >= MAX_PER_RUN:
            break
        now = datetime.now(timezone.utc)
        delta = (due - now).total_seconds()
        if delta > WEAR_OFF and not FORCE:
            log(f"skip future {send['clinic']} at {send['utc']}")
            continue
        if delta > 0 and not FORCE:
            log(f"sleep {delta:.0f}s until {send['utc']} for {send['clinic']}")
            time.sleep(delta)
        try:
            send_one(send)
            sent += 1
        except Exception as exc:
            log(f"FAILED {send.get('clinic')}: {exc}")
            try:
                close_and_discard()
            except Exception:
                pass
            time.sleep(3)
    log(f"runner done sent={sent}")


main()
