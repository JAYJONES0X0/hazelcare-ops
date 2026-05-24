# CareOps Architecture

## Overview
CareOps is built as a browser-first, local-first operational intelligence platform for the supported living sector. The architecture emphasizes privacy, compliance, and immediate utility without requiring complex backend integrations.

## Core Stack
- **Frontend Framework**: React with TypeScript, providing type safety and robust component architecture.
- **Styling**: Tailwind CSS / custom aesthetic tailored for clinical and professional trust.
- **Build Tool**: Vite for fast development and optimized production bundles.
- **Hosting**: Vercel for continuous deployment and edge delivery.

## Data Model & Privacy
- **Local-First Processing**: All data ingestion (Nourish CSVs, PDFs) occurs entirely within the browser. 
- **Persistence**: Application state and parsed data are stored in `localStorage`. There is no persistent backend database for core operations, ensuring that sensitive patient and care data never leaves the facility's local environment unless explicitly exported.
- **Zero-Transmission Guarantee**: The platform acts as a localized lens over existing data exports (Nourish/CarePlanner) rather than a cloud storage silo.

## Parsing Engine
- **Input Types**: Nourish weekly CSV exports, Word Documents (mammoth.js extraction), and PDFs (client-side text extraction).
- **Transformation**: Raw diaries and support plans are parsed and mapped into structured intelligence (flags, risks, compliance gaps, and task packs).

## Future Expansion (Enterprise Layer)
- **Role-Based Access Control (RBAC)**: Managed at the client side with potential future syncing.
- **Audit Trails**: Immutable execution logs and evidence lineage tracking.
- **Supabase Integration**: Planned strictly for document libraries (`Client Docs`) requiring persistent shared storage, with heavy encryption and strict RLS policies.
