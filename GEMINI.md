# HAZEL CARE OPS — ENGINEERING & BRANDING MANDATES

This file is a FOUNDATIONAL MANDATE for all Gemini CLI sessions. These rules must be followed with zero tolerance for failure.

## 1. 🛡️ DATA PRIVACY & SECURITY
- **LOCAL ONLY**: All data processing must happen in the browser (`localStorage` / `IndexedDB`).
- **NO TRANSMISSION**: Never introduce code that sends client data to external APIs or servers.
- **SELECTIVE PURGE**: Always maintain the "Stored Intelligence" feature allowing granular data clearing.

## 2. 🧼 BRANDING & JARGON SCRUB
- **ZERO NOURISH JARGON**: Use of "Nourish", "Accommodation Cleanliness and Comfort", or "Nodes" is strictly prohibited.
- **PROPRIETARY DOMAINS**: Use the 21 Premium Hazel Care Domains defined in `src/lib/client-store.ts`.
- **UNIFIED HEADERS**: All generated documents must use the `renderHeader` logic with the Hazel Care Operations logo block.

## 3. 🚀 ZERO-FAILURE DEPLOYMENT
- **BUILD CHECK**: You MUST run `npm run build` locally before every single `git push`.
- **VARIABLE NAMES**: Never use spaces, ampersands, or special characters in object properties (e.g., use `medicationRows`, NOT `Medication & SafetyRows`).
- **SVG DATA**: Always verify SVG path data strings are valid and closed. Malformed SVGs crash the React render loop.
- **VERCEL SYNC**: Ensure `vercel.json` always has `"github": { "enabled": true }`.

## 4. 🧠 INTELLIGENCE LAYER
- **CONTEXTUAL AUTO-FILL**: Maintain the "Synthesise from Intelligence" button in all builders.
- **GUIDED IMPORTS**: The Import Hub must always use the Decision Matrix to guide users on where to route their data.

## 5. 📐 UI & SIZING
- **MAX WIDTHS**: Ensure all standalone views and builders use `max-w-6xl` or similar constraints to prevent "floating box" syndrome on large monitors.
- **STICKY FOOTERS**: Printed documents must have the "HAZEL CARE LTD" footer anchored to the bottom of the page.

---
*FAILURE TO FOLLOW THESE MANDATES RESULTS IN PRODUCTION CRASHES. VERIFY EVERY LINE.*
