#!/usr/bin/env python3
"""
Agent 4: Browser Outreach & Inbox Agent.
Controls Hostinger Reach / Webmail via browser-harness to execute timezone-accurate dispatches,
commit recipient chips, verify send toasts, and triage inbox replies.
"""

import sys
import os
import json
import time
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path("/Users/up_2/Valioz Os")

class BrowserOutreachAgent:
    def __init__(self):
        self.browser_harness_bin = "/Users/up_2/.local/bin/browser-harness"

    def run_harness_script(self, py_script: str) -> dict:
        """Execute a Python snippet through the browser-harness CLI."""
        process = subprocess.run(
            [self.browser_harness_bin],
            input=py_script.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60
        )
        stdout = process.stdout.decode("utf-8", errors="ignore").strip()
        stderr = process.stderr.decode("utf-8", errors="ignore").strip()
        return {
            "returncode": process.returncode,
            "stdout": stdout,
            "stderr": stderr
        }

    def check_session(self) -> dict:
        """Check if Hostinger Webmail tab is open in Chrome."""
        script = """
import json
tabs = list_tabs()
mail_tabs = [t for t in tabs if "mail.hostinger.com" in t.get("url", "")]
result = {
    "active": len(mail_tabs) > 0,
    "tab_count": len(tabs),
    "mail_tab": mail_tabs[0] if mail_tabs else None
}
print(json.dumps(result))
"""
        res = self.run_harness_script(script)
        if res["returncode"] == 0:
            try:
                # Find the JSON line in output
                lines = res["stdout"].splitlines()
                for l in reversed(lines):
                    if l.startswith("{") and l.endswith("}"):
                        return json.loads(l)
            except Exception:
                pass
        return {"active": False, "error": res["stderr"] or res["stdout"]}

    def send_email(self, to_email: str, subject: str, html_file_path: Path, dry_run: bool = False) -> dict:
        """Compose and send an email in the active Hostinger tab."""
        if not html_file_path.exists():
            return {"success": False, "error": f"HTML file not found: {html_file_path}"}

        html_content = html_file_path.read_text(encoding="utf-8")
        import base64
        payload_b64 = base64.b64encode(html_content.encode("utf-8")).decode()

        if dry_run:
            print(f"[DRY RUN] Would send to: {to_email} | Subject: {subject} | Path: {html_file_path}")
            return {"success": True, "dry_run": True, "to": to_email}

        script = f"""
import json, time, sys

tabs = list_tabs()
mail_tabs = [t for t in tabs if "mail.hostinger.com" in t.get("url", "")]
if not mail_tabs:
    print(json.dumps({{"success": False, "error": "Hostinger webmail tab not found"}}))
    sys.exit(0)

target_id = mail_tabs[0]["target_id"]
switch_tab(target_id)
time.sleep(1)

# Ensure on inbox
url = page_info()["url"]
if "/mailboxes/INBOX" not in url or "/INBOX." in url:
    goto_url("https://mail.hostinger.com/0/mailboxes/INBOX")
    wait_for_load()
    time.sleep(2)

# Click 'New message'
click_expr = \"\"\"(function(){{
    var btn = document.querySelector('[data-qa=\"sidebar-new-message\"]');
    if (btn) {{
        btn.click();
        return 'ok';
    }}
    var bs = document.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {{
        var t = (bs[i].innerText || '').trim();
        if (t === 'New message' || bs[i].getAttribute('aria-label') === 'New message') {{
            bs[i].click();
            return 'ok';
        }}
    }}
    return 'no';
}})()\"\"\"

# Check if composer is already open
composer_open = js("!!document.getElementById('to') && !!document.getElementById('subject')")

if not composer_open:
    for _ in range(20):
        if js(click_expr) == 'ok':
            break
        time.sleep(1)

    # Wait for compose fields
    for _ in range(30):
        if js("!!document.getElementById('to') && !!document.getElementById('subject')"):
            break
        time.sleep(0.5)

# Check if recipient chip is already committed
to_addr = {json.dumps(to_email)}
has_chip_expr = \"\"\"(function(){{
    var bs = Array.from(document.querySelectorAll('button')).map(function(b){{ return (b.innerText || '').trim(); }});
    return bs.includes(%s);
}})()\"\"\" % json.dumps(to_addr)

has_chip = js(has_chip_expr)

if has_chip:
    chip_committed = True
else:
    set_to = \"\"\"(function(){{
        var e = document.getElementById('to');
        if (!e) return 'no';
        e.focus();
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(e, %s);
        e.dispatchEvent(new Event('input', {{bubbles: true}}));
        e.dispatchEvent(new Event('change', {{bubbles: true}}));
        e.dispatchEvent(new KeyboardEvent('keydown', {{key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}}));
        e.dispatchEvent(new KeyboardEvent('keyup', {{key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}}));
        return 'ok';
    }})()\"\"\" % json.dumps(to_addr)

    js(set_to)
    time.sleep(0.5)
    press_key(\"Tab\")
    time.sleep(1)
    
    chip_committed = False
    for attempt in range(5):
        chips_present = js(\"\"\"(function(){{
            var bs = Array.from(document.querySelectorAll('button')).map(function(b){{ return (b.innerText || '').trim(); }});
            return bs.some(function(t){{ return t.includes(%s); }});
        }})()\"\"\" % json.dumps(to_addr))
        val = js(\"(function(){{var e=document.getElementById('to');return e ? e.value : '__none__';}})()\")
        if chips_present or val == \"\":
            chip_committed = True
            break
        js(\"\"\"(function(){{
            var e = document.getElementById('to');
            if (e) {{
                e.focus();
                e.dispatchEvent(new KeyboardEvent('keydown', {{key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}}));
                e.dispatchEvent(new KeyboardEvent('keyup', {{key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}}));
            }}
        }})()\"\"\")
        time.sleep(0.5)
        press_key(\"Tab\")
        time.sleep(1)

if not chip_committed:
    print(json.dumps({{"success": False, "error": "Failed to commit recipient chip in #to"}}))
    sys.exit(0)

# Set subject
subj = {json.dumps(subject)}
set_subj = \"\"\"(function(){{
    var e = document.getElementById('subject');
    if (!e) return 'no';
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(e, %s);
    e.dispatchEvent(new Event('input', {{bubbles: true}}));
    e.dispatchEvent(new Event('change', {{bubbles: true}}));
    return 'ok';
}})()\"\"\" % json.dumps(subj)
js(set_subj)
time.sleep(1)

# Inject HTML into composer iframe
payload = {json.dumps(payload_b64)}
inject_expr = \"\"\"(function(){{
    var bin = atob(%s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var html = new TextDecoder('utf-8').decode(bytes);
    var fs = document.querySelectorAll('iframe');
    for (var j = 0; j < fs.length; j++) {{
        var d = fs[j].contentDocument;
        var b = d && d.querySelector('[data-qa=\"composer-content-body\"]');
        if (b) {{
            b.innerHTML = html;
            b.dispatchEvent(new Event('input', {{bubbles: true}}));
            b.dispatchEvent(new Event('change', {{bubbles: true}}));
            return 'injected';
        }}
    }}
    return 'no body';
}})()\"\"\" % json.dumps(payload)

inj_res = js(inject_expr)
if inj_res != 'injected':
    print(json.dumps({{"success": False, "error": f"Failed to inject HTML: {{inj_res}}"}}))
    sys.exit(0)

time.sleep(2)

# Click Send via native CDP coordinates
rect_expr = \"\"\"(function(){{
    var bs = document.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {{
        var t = (bs[i].innerText || '').trim();
        if (t === 'Send') {{
            var r = bs[i].getBoundingClientRect();
            return {{x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: bs[i].disabled}};
        }}
    }}
    return null;
}})()\"\"\"

rect = js(rect_expr)
if rect and not rect.get("disabled"):
    click_at_xy(rect["x"], rect["y"])
time.sleep(1)
# Guarantee click if still open
js(\"\"\"(function(){{
    var bs = document.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {{
        if ((bs[i].innerText || '').trim() === 'Send' && !bs[i].disabled) {{
            bs[i].click();
            return;
        }}
    }}
}})()\"\"\")

# Wait for toast confirmation or composer closure
toast_seen = False
for _ in range(30):
    body_text = js("(document.body.innerText || '')")
    composer_closed = js("!document.getElementById('to')")
    if "Message sent successfully" in body_text or "Message sent" in body_text or composer_closed:
        toast_seen = True
        break
    time.sleep(0.5)

print(json.dumps({{"success": toast_seen, "to": to_addr, "subject": subj}}))
"""
        res = self.run_harness_script(script)
        if res["returncode"] == 0:
            lines = res["stdout"].splitlines()
            for l in reversed(lines):
                if l.startswith("{") and l.endswith("}"):
                    try:
                        return json.loads(l)
                    except Exception:
                        pass
        return {"success": False, "error": res["stderr"] or res["stdout"]}

    def send_test_email(self, test_recipient: str, clinic_slug: str = "brampton-dental-arts") -> dict:
        """Send a test personalized dual-branded email to a verified test address."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        html_path = ROOT / f"dist/outreach-queue/{date_str}/{clinic_slug}/01-welcome.html"
        if not html_path.exists():
            # If today's queue doesn't have it, look in latest queue
            candidates = list(ROOT.glob(f"dist/outreach-queue/*/{clinic_slug}/01-welcome.html"))
            if candidates:
                html_path = candidates[-1]
            else:
                return {"success": False, "error": f"Sample HTML for {clinic_slug} not found"}

        subject = f"[TEST] Dr. Sheikh, your Brampton Dental Arts growth audit (VALIOZ Health)"
        print(f"=== DISPATCHING TEST EMAIL ===")
        print(f"To: {test_recipient}")
        print(f"Subject: {subject}")
        print(f"Using template: {html_path}")
        
        result = self.send_email(to_email=test_recipient, subject=subject, html_file_path=html_path)
        print(f"Result: {result}")
        return result

    def scan_inbox(self) -> list:
        """Read recent threads from Hostinger webmail inbox."""
        script = """
import json
tabs = list_tabs()
mail_tabs = [t for t in tabs if "mail.hostinger.com" in t.get("url", "")]
if not mail_tabs:
    print(json.dumps([]))
    import sys; sys.exit(0)

switch_tab(mail_tabs[0]["target_id"])
eval_expr = \"\"\"(function(){
    var items = document.querySelectorAll('[role="row"], [data-qa="conversation-list-item"]');
    var results = [];
    for (var i = 0; i < Math.min(items.length, 15); i++) {
        var text = items[i].innerText || '';
        results.push({
            "preview": text.replace(/\\n+/g, ' ').substring(0, 150)
        });
    }
    return results;
})()\"\"\"
threads = js(eval_expr)
print(json.dumps(threads))
"""
        res = self.run_harness_script(script)
        if res["returncode"] == 0:
            try:
                lines = res["stdout"].splitlines()
                for l in reversed(lines):
                    if l.startswith("[") and l.endswith("]"):
                        return json.loads(l)
            except Exception:
                pass
        return []

if __name__ == "__main__":
    agent = BrowserOutreachAgent()
    if "--check" in sys.argv:
        print(agent.check_session())
    elif "--test-send" in sys.argv:
        idx = sys.argv.index("--test-send")
        recipient = sys.argv[idx + 1] if len(sys.argv) > idx + 1 else "ibrahim.zed24@gmail.com"
        res = agent.send_test_email(test_recipient=recipient)
        print("Test Send Result:", res)
    elif "--scan" in sys.argv:
        threads = agent.scan_inbox()
        print(f"Scanned {len(threads)} inbox items:", threads)
    else:
        print("Usage:")
        print("  python agent.py --check")
        print("  python agent.py --test-send <email>")
        print("  python agent.py --scan")
