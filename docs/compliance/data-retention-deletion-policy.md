# CareOps Pilot Data Retention & Deletion Policy

## Policy Intent
Define how pilot operators retain and delete operational data processed in CareOps.

## Baseline Rules
- Keep only data required for active operational review.
- Do not retain exports beyond provider-defined governance windows.
- Treat local browser storage as sensitive operational data.

## Retention Windows (Pilot Default)
- Active review datasets: up to 30 days unless governance requires longer.
- Generated pilot artefacts (task packs, reports): align with provider record policy.
- Debug/smoke artefacts: remove once release verification is complete unless needed for audit evidence.

## Deletion Procedure
1. End active session and sign out.
2. Run local purge controls in CareOps.
3. Clear browser storage for CareOps origin where required.
4. Remove local test artefacts from workstation.
5. Record deletion action in pilot operations log.

## Exceptions
Where safeguarding, legal hold, or regulator instruction applies, provider policy overrides default deletion timings.

