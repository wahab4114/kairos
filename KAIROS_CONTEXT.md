# Kairos Session Context

Last updated: 2026-05-04

## Project Goal
Kairos is an intelligent personal investing assistant (web + app experience via responsive web/PWA path) focused on speed, simplicity, trustworthy decision support, and future scalability.

Primary user intent:
- Track watchlist stocks (initially inspired by Scalable Capital usage in Germany, but not broker-limited)
- Receive company-level updates from online sources (Yahoo-style/news-feed experience) for watchlist stocks
- Keep UI modern and clean (glassmorphism direction)
- Add an intelligent recommendation layer that suggests buy/sell/hold actions for watchlist and new stocks using:
  - market performance signals
  - company history/fundamentals
  - relevant online context/data
- Keep this recommendation layer explainable (show reasons, confidence, and risk notes)
- Add chat module later (after recommendation engine and data layers are stable)

## Current Architecture
- Frontend: React + TypeScript + Vite
- Styling: Custom glassmorphism UI + Lucide icons
- Data/Auth: Supabase-ready foundation with demo fallback mode
- State layer: Context-based, repository abstraction for stock data

## Key Implemented Features
- Dark/light theme toggle
- Dashboard view
- Watchlist view
- Intelligence view (company updates + guidance)
- Modern icon system (Lucide)
- Demo mode persistence for stocks
- Supabase auth + backend integration scaffolding

## Major Files and Their Roles
- src/App.tsx
  - App shell and tab navigation
  - Auth gating logic (shows auth screen when Supabase is configured and user is not signed in)
- src/contexts/ThemeContext.tsx
  - Theme state and toggle behavior
- src/contexts/AuthContext.tsx
  - Auth state, magic-link sign-in, sign-out
  - Demo mode behavior when env vars are missing
- src/contexts/StockContext.tsx
  - Stocks state and CRUD orchestration
  - Uses repository functions instead of direct localStorage operations
- src/services/stockRepository.ts
  - Data access abstraction
  - Uses Supabase when configured
  - Falls back to local storage per user key in demo mode
- src/components/Intelligence/Intelligence.tsx
  - Company updates and recommendation guidance UI
- src/lib/supabase.ts
  - Supabase client factory + configuration checks
- src/components/Auth/AuthScreen.tsx
  - Magic-link sign-in UI
- src/components/Navbar.tsx
  - Theme toggle + auth state display + sign-out button
- src/components/Portfolio.tsx
  - Dashboard stats and recent watchlist section
- src/components/Watchlist/Watchlist.tsx
  - Add/remove/update stocks UI
- supabase/schema.sql
  - Database schema + RLS policies
- .env.example
  - Required Supabase env variables

## Supabase Foundation Already Added
- Package installed: @supabase/supabase-js
- Env typing added in src/vite-env.d.ts
- Auth flow prepared for email magic-link
- SQL schema includes:
  - profiles
  - watchlist_stocks
  - indexes and row-level security policies

## Current Runtime Modes
1) Demo mode (default if env vars are missing)
- Uses local persistence via repository fallback
- User shown as demo mode

2) Supabase mode (enabled when env vars are provided)
- Uses Supabase auth + database
- User must sign in with email magic link

## Remaining Work (Next Priorities)
1. Connect live Supabase credentials
  - Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
  - Run schema SQL in Supabase SQL Editor
  - Enable email auth provider in Supabase
  - Verify sign-in and CRUD

2. Build intelligent recommendation engine (buy/sell/hold)
  - Define advisor inputs (price trends, indicators, company fundamentals, news/context)
  - Build scoring/explanation pipeline with confidence output
  - Add UI surfaces for recommendations on watchlist and stock detail context
  - Add guardrails/disclaimer language and transparent reasoning

3. Build company intelligence feed
  - Track online company/news updates for each watchlist symbol
  - Summarize key events and potential impact
  - Add digest + notification delivery strategy

4. Convert app to PWA
  - Install/configure Vite PWA plugin
  - Add manifest + icons + service worker strategy
  - Validate installability and offline behavior

## Known Notes
- The app was refactored to remove older duplicate component blocks and now uses Watchlist + Intelligence flow (alerts removed).
- Build currently succeeds after Supabase foundation integration.

## Quick Resume Prompt (for next sessions)
Use this prompt to continue quickly:

"Read KAIROS_CONTEXT.md first, then continue from the current state. Focus on company intelligence feed + explainable buy/sell/hold guidance, and keep architecture broker-agnostic."

## Optional Next Prompt Variants
- "Read KAIROS_CONTEXT.md and implement PWA conversion now."
- "Read KAIROS_CONTEXT.md and integrate real stock price provider after Supabase setup."
- "Read KAIROS_CONTEXT.md and implement the recommendation engine MVP (signals + scoring + explanations)."
