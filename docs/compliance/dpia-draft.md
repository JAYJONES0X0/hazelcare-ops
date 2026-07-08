# CareOps DPIA Draft (Pilot v1)

## Scope
CareOps is a local-first operational intelligence operating system used by adult social care managers to process care evidence inside a browser session and turn it into reviewed actions, outputs, and audit trails.

## Processing Summary
- Input sources: provider exports (CSV, XLSX, PDF, DOCX, ZIP, pasted text).
- Processing location: in-browser runtime.
- Storage model: session memory + local browser storage where configured.
- Output: manager briefings, task packs, audit reports, and evidence-linked summaries.

## Personal Data Categories
- Service-user identifiers and care narrative entries.
- Staff identifiers and shift/roster context.
- Incident and compliance-related operational records.

## Lawful Basis (Controller-side)
- Care provider (controller) remains responsible for lawful basis under UK GDPR and care-sector obligations.
- CareOps processes data under provider instruction for quality, safety, and governance workflows.

## Risk Assessment (Pilot)
- Risk: unauthorised access to local session on shared device.
  - Mitigation: authenticated gate, session controls, operator training.
- Risk: over-retention of sensitive records.
  - Mitigation: retention/deletion protocol and local purge controls.
- Risk: incorrect interpretation of imported records.
  - Mitigation: human review states, audit lineage, operator verification.

## Data Subject Rights Support
- Access/rectification/erasure requests are executed by the provider controller.
- CareOps supports deletion by local purge and controlled export handling.

## Transfers
- No automatic external transfer of imported care content by default design.
- Any export is operator-initiated and remains provider-controlled.

## Residual Risk
Residual risk is acceptable for controlled pilot use with trained operators and explicit governance controls.
