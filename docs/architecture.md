# CareOps Architecture

## Overview
CareOps is built as a browser-first, local-first operational intelligence platform for the supported living sector. The architecture emphasizes privacy, compliance, and immediate utility without requiring complex backend integrations.

## Core Stack
- **Frontend Framework**: React with TypeScript, providing type safety and robust component architecture.
- **Styling**: Tailwind CSS / custom aesthetic tailored for clinical and professional trust.
- **Build Tool**: Vite for fast development and optimized production bundles.
- **Hosting**: Vercel for continuous deployment and edge delivery.

## Data Model & Privacy
- **Local-First Processing**: Core evidence ingestion (CSV, PDF, DOCX, ZIP packs, rosters, and pasted text) occurs entirely within the browser where supported.
- **Persistence**: Application state and parsed data are stored in `localStorage`. There is no persistent backend database for core operations, ensuring that sensitive patient and care data never leaves the facility's local environment unless explicitly exported.
- **Zero-Transmission Guarantee**: The platform treats existing record exports as source inputs for its own evidence, action, review, output, and audit loop rather than acting as a cloud storage silo.

## Parsing Engine
- **Input Types**: Diary CSV exports, roster exports, Word documents (mammoth.js extraction), ZIP packs, pasted text, images, and PDFs (client-side text extraction where possible).
- **Transformation**: Raw diaries and support plans are parsed and mapped into structured intelligence (flags, risks, compliance gaps, and task packs).

## Future Expansion (Enterprise Layer)
- **Role-Based Access Control (RBAC)**: Managed at the client side with potential future syncing.
- **Audit Trails**: Immutable execution logs and evidence lineage tracking.
- **Supabase Integration**: Planned strictly for document libraries (`Client Docs`) requiring persistent shared storage, with heavy encryption and strict RLS policies.
