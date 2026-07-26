from pathlib import Path
from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:4199/CareOps"
SCREENSHOT = Path("tmp/client-finance-reconciliation-correction-smoke.png")
DOWNLOAD = Path("tmp/client-money-audit-pack-smoke.txt")


def first_by_text(page, text):
    return page.get_by_text(text, exact=False).first


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1600, "height": 1200}, accept_downloads=True)
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
    first_by_text(page, "Capture receipt evidence").click()
    expect(first_by_text(page, "Proposed Transaction")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "Not posted")).to_be_visible(timeout=5000)
    first_by_text(page, "Confirm and post").click()
    expect(first_by_text(page, "Tesco Express")).to_be_visible(timeout=5000)

    first_by_text(page, "Run reconciliation").click()
    expect(first_by_text(page, "Approve reconciliation")).to_be_visible(timeout=5000)
    first_by_text(page, "Approve reconciliation").click()
    expect(first_by_text(page, "Approved by")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "reconciled")).to_be_visible(timeout=5000)

    first_by_text(page, "Open correction review").click()
    expect(first_by_text(page, "Correction Review")).to_be_visible(timeout=5000)
    page.get_by_label("Corrected amount").fill("10.00")
    page.get_by_label("Correction reason").fill("Smoke-test correction event after manager review.")
    first_by_text(page, "Create correction event").click()
    expect(first_by_text(page, "Correction:")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "disputed")).to_be_visible(timeout=5000)
    expect(first_by_text(page, "No open financial safeguarding exceptions detected")).to_be_visible(timeout=5000)

    page.get_by_placeholder("Payee or source").fill("Unspecified purchase")
    page.get_by_placeholder("Support context").fill("Manual spending record awaiting receipt evidence.")
    first_by_text(page, "Record review-required transaction").click()
    expect(first_by_text(page, "transaction without receipt")).to_be_visible(timeout=5000)
    first_by_text(page, "Assign to me").click()
    expect(first_by_text(page, "Assigned to Current staff member")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Resolve").first.click()
    expect(first_by_text(page, "No open financial safeguarding exceptions detected")).to_be_visible(timeout=5000)

    with page.expect_download() as download_info:
        first_by_text(page, "Export finance evidence pack").click()
    download = download_info.value
    DOWNLOAD.parent.mkdir(parents=True, exist_ok=True)
    download.save_as(str(DOWNLOAD))
    content = DOWNLOAD.read_text(encoding="utf-8")
    assert "CLIENT MONEY & FINANCIAL SAFEGUARDING PACK" in content
    assert "SOURCE EVIDENCE" in content
    assert "RECONCILIATION" in content
    assert "Correction:" in content

    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    browser.close()

print(f"SMOKE_OK screenshot={SCREENSHOT} download={DOWNLOAD}")
