# CareOps Execution Roadmap

## Current State
- Advanced prototype with 100% functional local-first processing.
- Core tools (Import, Note Assistant, Templates, Reports, Compliance, Risk Scores, Incidents) are production-ready for test runs.
- Staff Register and Client Docs are partially built or placeholder.

## Critical Fixes
- Unify Staff Register with the Compliance module's staff tracking.
- Fix Handover auto-population (pull client concerns directly from weekData).
- Replace placeholder Client Docs with real file handling or remove if out of scope for local-first.

## Enterprise Readiness (Immediate Priority)
- **Evidence Lineage**: Prove where every generated insight came from.
- **Audit Trail**: Track when documents were generated, viewed, and exported.
- **Import Quality Report**: Validate CSV/PDF imports and highlight missing data.
- **Human Review States**: Enforce "Reviewed by Manager" sign-offs on critical flags.
- **Parser Validation**: Ensure source-system CSV/PDF parsers handle edge cases without silent failures.

## UX Improvements
- Implement visual hierarchy for urgency levels in the Morning Briefing.
- Expand entry cards in the Dashboard to prevent text truncation.
- Consolidate and simplify navigation to reduce cognitive load.

## Security & Compliance
- DPIA, DPA, data deletion protocols.
- Clinical safety boundaries clearly defined.
- AI transparency (clear markers on AI-generated summaries).

## Team Features
- Role-Based Access Control (RBAC) / Role model for Managers vs. Seniors.

## Long-Term Vision
- Optional, consented integrations with provider record APIs where privacy, contracts, and security constraints allow.
- Predictive risk analytics based on longitudinal data trends.
