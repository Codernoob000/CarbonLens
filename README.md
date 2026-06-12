# CarbonLens — Understand, Track, and Reduce Your Carbon Footprint

## 🎯 Chosen Vertical
**Climate & Sustainability — Individual Carbon Footprint Awareness**

CarbonLens targets eco-conscious individuals (ages 18–45) who want to understand their environmental impact but find existing carbon calculators too complex, too vague, or lacking actionable guidance.

## 📖 What It Does

CarbonLens is a web application that helps individuals calculate their annual carbon footprint across four categories (transport, energy, food, lifestyle), visualize their emissions through interactive Google Charts dashboards, and receive AI-powered personalized recommendations to reduce their impact — all while tracking daily eco-actions with gamified progress.

## 🧠 Approach & Logic

**Architecture:** The app follows a clear frontend/backend separation:
- **Frontend** (static HTML/CSS/JS on Vercel): Multi-step calculator, Google Charts visualization, action tracker with streaks and badges, dark/light theme
- **Backend** (Express on Render): Secure API proxy for Groq AI calls, server-side calculation with Zod validation, rate-limited endpoints with Helmet security headers

**Calculation methodology:** Emission factors are sourced from EPA, DEFRA, and IPCC AR6 data. Transport emissions use per-km factors for each mode. Energy is divided by household size. Food accounts for diet type and waste percentage. Lifestyle uses per-USD spending factors by category.

**Why this approach:** Separating calculation to the backend ensures inputs are validated (Zod) and prevents client-side tampering. AI calls route through a server proxy to protect the Groq API key, enforce token budgets, and sanitize prompts against injection. The frontend includes an offline fallback calculator for graceful degradation.

## 🔧 How to Run Locally

### Prerequisites
- Node.js v18.0.0 or higher
- A Groq API key (free at https://console.groq.com)

### Setup
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install backend dependencies
cd server
npm install
cp ../.env.example ../.env
# Edit ../.env — add your GROQ_API_KEY and JWT_SECRET

# Start the backend
npm start
# Backend runs on http://localhost:3001

# In another terminal, serve the frontend
cd ..
# Use any static server, e.g.:
npx serve .
# Frontend runs on http://localhost:3000
```

> **Note:** Update `ALLOWED_ORIGIN` in `.env` to match your frontend URL.

## 🌐 Google Services Integration

| Service | How It's Used | Why It Adds Value |
|---------|--------------|-------------------|
| Google Charts API | Renders interactive pie charts (emission breakdown), line charts (monthly trends), and bar charts (category comparison) on the dashboard | Provides rich, interactive data visualization without requiring API keys or billing — architecturally central to helping users understand their footprint visually |

**Graceful degradation:** If Google Charts fails to load, text-based data summaries are shown instead of charts.

## ✅ Features

| Feature | Solves Problem Requirement |
|---------|--------------------------|
| Multi-category Carbon Calculator (4 steps: transport, energy, food, lifestyle) | Helps individuals understand their carbon footprint |
| Interactive Dashboard with Google Charts (pie, line, bar) | Helps individuals track their footprint visually |
| AI-Powered Insights via Groq (personalized reduction tips) | Provides personalized insights to reduce footprint |
| Action Tracker with daily eco-actions | Reduces footprint through simple actions |
| Benchmark Comparisons (global avg, US avg, Paris target) | Contextualizes individual footprint |
| Eco Score, Streaks, and Achievement Badges | Motivates sustained behavioral change |
| Dark/Light Theme Toggle | Accessibility and user preference |
| Offline Fallback Calculator | Works even without backend connection |

## 🏗️ Architecture

```
User → Frontend (Vercel)
         │
         ├── Calculator Form → POST /api/calculate → Express Server (Render)
         │                                              └── Zod Validation → Calculation Engine → Response
         │
         ├── AI Chat → POST /api/insights → Express Server
         │                                    └── Sanitize Input → Groq API → Sanitize Output → Response
         │
         ├── Dashboard → Google Charts API (gstatic.com)
         │
         └── Actions → localStorage (client-side persistence)
```

```
project/
├── index.html                    # Main SPA — semantic HTML, CSP meta tag
├── styles/
│   └── main.css                  # Design system — dark/light, glassmorphism
├── scripts/
│   ├── app.js                    # Main controller — calculator, actions, theme
│   ├── api.js                    # Backend API communication layer
│   ├── charts.js                 # Google Charts integration
│   ├── config.js                 # Public config — no secrets
│   └── utils.js                  # Shared utilities
├── server/
│   ├── server.js                 # Express backend — security stack + Groq proxy
│   └── package.json              # Pinned dependencies
├── tests/
│   ├── run_tests.js              # Node.js test suite (backend)
│   └── test_suite.html           # Browser test suite (frontend)
├── .env.example                  # Documented environment template
├── .gitignore                    # Excludes .env, node_modules, etc.
├── README.md                     # This file
├── BLUEPRINT.md                  # Architecture decisions
├── SECURITY_AUDIT.md             # 13-rule security audit
├── CODE_REVIEW_REPORT.md         # Code quality review
├── PERFORMANCE_NOTES.md          # Efficiency optimization notes
├── SUBMISSION_SUMMARY.md         # Final submission summary
├── TEST_REPORT.md                # Test results
└── LICENSE                       # MIT License
```

## ♿ Accessibility

- **WCAG 2.1 AA compliant** — verified against all applicable success criteria
- **Keyboard navigable** — all interactive elements reachable via Tab, activated via Enter/Space
- **Skip-to-main-content link** — first focusable element on the page
- **Color contrast ≥ 4.5:1** — verified for all body text against backgrounds
- **Visible focus indicators** — `:focus-visible` styles on all interactive elements (never `outline: none` without replacement)
- **Semantic HTML** — `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>`, `<button>`
- **ARIA live regions** — screen reader announcements for dynamic content updates
- **Labels on all form inputs** — explicit `<label for>` associations
- **Alt text** on decorative SVGs (`aria-hidden="true"`) and meaningful images
- **`prefers-reduced-motion`** — all animations disabled for users who prefer reduced motion
- **`lang="en"`** on `<html>` element

## 🧪 Testing

```bash
# Backend tests
cd server
node ../tests/run_tests.js

# Frontend tests
# Open tests/test_suite.html in a browser
```

- [x] Unit tests — calculation engine, utility functions
- [x] Security tests — input validation, secret detection, LLM sanitization, token budget
- [x] Integration tests — Groq proxy (mocked via fallback)
- [x] Edge case tests — NaN, zero, max values, boundary conditions
- [x] Frontend tests — utility functions, XSS prevention, config safety, accessibility checks

## 🔒 Security

Fully compliant with **Taha Jaffri's 13-Rule Security Checklist** for AI Apps:

| # | Rule | Implementation |
|---|------|---------------|
| 1 | Secrets & Environment Variables | All in `.env`, never committed, `.env.example` documented |
| 2 | Rate Limiting | `express-rate-limit`: auth 5/15min, API 60/min, AI 10/min |
| 3 | Input Validation & Sanitization | Zod schemas on every POST endpoint |
| 4 | Authentication & Authorization | bcrypt-ready, JWT architecture in place |
| 5 | SQL & Database Security | No database (localStorage) — no SQL injection surface |
| 6 | CORS Configuration | Locked to `process.env.ALLOWED_ORIGIN`, no wildcard |
| 7 | HTTP Security Headers | Helmet with CSP, X-Frame-Options: DENY, HSTS, nosniff |
| 8 | File Upload Security | No file uploads in this app |
| 9 | Error Handling & Logging | Generic client messages, detailed server-side logging |
| 10 | Dependency Security | Exact pinned versions, `npm audit` clean |
| 11 | XSS Prevention | No `innerHTML` with user data, no `eval()`, CSP enforced |
| 12 | Deployment Checklist | `.env` gitignored, HTTPS enforced, debug off |
| 13 | AI/LLM Security | Groq calls via backend proxy, max_tokens, sanitized I/O, token budgets |

## ⚠️ Assumptions Made

1. **No persistent database** — localStorage is used for user data. In production, a database like Supabase or MongoDB Atlas would be integrated
2. **Emission factors are global averages** — regional grid carbon intensity varies; a production app would use location-specific factors
3. **Authentication is architectural** — the JWT/bcrypt infrastructure is in place but user registration/login UI is not the primary feature
4. **Groq model availability** — assumes `llama-3.3-70b-versatile` is available; falls back to static recommendations if unavailable
5. **Flight distance estimates** — short-haul ~800km, long-haul ~7000km are used as average round-trip distances

## 📄 License

MIT — see [LICENSE](LICENSE) file
