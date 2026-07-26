from pathlib import Path
from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:4199/CareOps"
SCREENSHOT = Path("tmp/client-finance-match-approval-smoke.png")


def first_by_text(page, text):
    return page.get_by_text(text, exact=False).first


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1600, "height": 1100})
    context.add_init_script(
        """
        localStorage.setItem('hc-local-preview-auth', 'true');
        localStorage.setItem('hc-local-preview-role', 'admin');
        localStorage.setItem('hc-user-role', 'admin');
        localStorage.setItem('hc_current_page', 'client-finance');
        localStorage.setItem('hc-theme', 'bone');
        localStorage.removeItem('hc-client-finance-v1');
        """
    )
    page = context.new_page()
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    expect(first_by_text(page, "Client Care")).to_be_visible(timeout=12000)
    first_by_text(page, "Client Care").click()
    expect(first_by_text(page, "Money & Safeguarding")).to_be_visible(timeout=12000)
    first_by_text(page, "Money & Safeguarding").click()
    page.wait_for_load_state("networkidle")
    expect(first_by_text(page, "Money & Financial Safeguarding")).to_be_visible(timeout=12000)

    first_by_text(page, "Create client money account").click()
    expect(first_by_text(page, "Receipt Inbox")).to_be_visible(timeout=5000)

    first_by_text(page, "Capture batch receipts").click()
    expect(first_by_text(page, "2 captured")).to_be_visible(timeout=5000)

    first_by_text(page, "Parse ledger evidence").click()
    expect(first_by_text(page, "Receipt match proposals")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "Accept as proposed transaction")).to_be_visible(timeout=5000)

    first_by_text(page, "Accept as proposed transaction").click()
    expect(first_by_text(page, "Proposed Transaction")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "Not posted")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "Confirm and post")).to_be_visible(timeout=5000)

    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    browser.close()

print(f"SMOKE_OK screenshot={SCREENSHOT}")
