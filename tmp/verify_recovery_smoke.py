import json

from playwright.sync_api import sync_playwright, expect

APP_URL = "http://127.0.0.1:5193/CareOps?localLoginFixed=1"

PHANTOM_CLIENTS = r"""
[
  {
    "id": "client-empty-pack",
    "name": "Draft Shell",
    "preferredName": "Draft",
    "dob": "",
    "address": "",
    "nhs": "",
    "phone": "",
    "diagnoses": [],
    "keyWorker": "",
    "responsible": "",
    "completedBy": "",
    "dateOfAdmission": "",
    "reviewDate": "",
    "createdAt": "2026-06-18T10:00:00.000Z",
    "updatedAt": "2026-06-18T10:00:00.000Z",
    "pbs": null,
    "risk": null,
    "carePlan": null,
    "supportPlan": null,
    "documents": [],
    "vaultDocs": [],
    "onboardingStatus": "DRAFT_CLIENT",
    "liveGateSummary": {
      "liveReady": false,
      "gates": [],
      "missingGates": [],
      "blockedReasons": ["Synthetic stale shell should not show without files."],
      "openReviewItems": 0,
      "identityReviewed": false,
      "contactsReviewed": false,
      "consentBoundariesReviewed": false,
      "careSupportPlanSource": "missing",
      "riskSource": "missing",
      "pbsSource": "missing",
      "medicationSource": "missing",
      "financeLegalReviewed": false,
      "unknownDocumentsReviewedOrDeferred": false
    },
    "packImports": [
      {
        "packId": "pack-empty",
        "uploadedAt": "2026-06-18T10:00:00.000Z",
        "uploadedBy": "tester",
        "sourceName": "stale-empty-pack",
        "sourceType": "zip",
        "status": "DRAFT_CLIENT",
        "candidateClientId": "client-empty-pack",
        "candidateClientName": "Draft Shell",
        "identityConfidence": 0,
        "filesTotal": 0,
        "filesParsed": 0,
        "filesAttached": 0,
        "filesFailed": 0,
        "filesNeedsReview": 0,
        "manifestRows": [],
        "auditEventIds": []
      }
    ]
  }
]
"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        page.add_init_script(
            f"""
            (() => {{
              localStorage.clear();
              localStorage.setItem('hc-local-preview-auth', 'true');
              localStorage.setItem('hc-local-preview-role', 'admin');
              localStorage.setItem('hc-user-role', 'admin');
              localStorage.setItem('hc_current_page', 'dashboard');
              localStorage.setItem('hc-clients-v2', {json.dumps(PHANTOM_CLIENTS)});
            }})();
            """
        )

        page.goto(APP_URL)
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tmp/recovery-smoke-dashboard.png", full_page=True)

        body = page.locator("body")
        expect(body).not_to_contain_text("System Recovery Mode")
        expect(body).not_to_contain_text("CLIENT PACK REVIEW QUEUE ACTIVE")
        expect(body).not_to_contain_text("1 DRAFT PACK / 0 FILE REVIEW ITEMS")

        page.get_by_role("button", name="IMPORT HUB").first.click()
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tmp/recovery-smoke-import-hub.png", full_page=True)
        expect(body).to_contain_text("Import Hub")
        expect(body).not_to_contain_text("System Recovery Mode")

        relevant_errors = [
            message
            for message in errors
            if "favicon" not in message.lower() and "failed to load resource" not in message.lower()
        ]
        if relevant_errors:
            raise AssertionError("\\n".join(relevant_errors))

        browser.close()


if __name__ == "__main__":
    main()
