# CarbonLens — Blueprint (Architecture Document)

## Chosen Vertical
**Climate & Sustainability — Individual Carbon Footprint Awareness**

## User Persona
Eco-conscious individuals aged 18–45 who want to understand their environmental impact but find existing tools too complex or lacking actionable guidance.

## Problem → Feature Mapping

| Problem Requirement | Feature | Implementation |
|---|---|---|
| Understand carbon footprint | Multi-category Calculator | 4-step form (transport, energy, food, lifestyle) with EPA/DEFRA emission factors |
| Track footprint over time | Dashboard with Google Charts | Pie, line, and bar charts with monthly history |
| Personalized insights | AI-Powered Analysis | Groq AI proxy with context-aware recommendations |
| Reduce through simple actions | Action Tracker | 8 daily eco-actions with CO₂ savings estimates |
| Benchmark against averages | Comparison Widget | Global avg, US avg, Paris target comparison bar |
| Motivation & engagement | Gamification | Eco score, daily streaks, 4 achievement badges |

## Tech Stack

| Technology | Role | Justification |
|---|---|---|
| HTML5 | Structure | Semantic, accessible, lightweight |
| Vanilla CSS | Styling | Full control, no framework overhead, custom properties |
| Vanilla JavaScript | Logic | Zero dependencies on frontend, maximum efficiency |
| Express.js | Backend | Industry standard, Helmet/CORS/rate-limit ecosystem |
| Groq SDK | AI | Fast LLM inference, free tier available |
| Google Charts | Visualization | Google Service requirement, rich interactivity, no API key needed |
| Zod | Validation | Type-safe schema validation on all inputs |
| Helmet | Security | HTTP security headers in one package |

## Google Services — Architectural Role

**Google Charts API** is the primary Google Service integration:
- Renders 3 interactive chart types (pie, line, bar) on the dashboard
- Theme-aware coloring (dark/light mode)
- Responsive resizing with debounce
- Graceful degradation to text fallback if unavailable
- Loaded from `gstatic.com` — public library, no API key required

## Security Threat Model

| Threat Surface | Protection |
|---|---|
| User input (forms, chat) | Zod validation server-side, client-side sanitization for UX |
| Groq API key exposure | Server-side only, `.env`, never in frontend code |
| JWT secret exposure | `.env`, minimum 32 chars recommended |
| Prompt injection via AI chat | `sanitizeLLMInput()` filters keywords, truncates, removes HTML |
| XSS via AI output | `textContent` only for DOM insertion, no `innerHTML` |
| DDoS / abuse | Rate limiting per endpoint type (auth, API, AI) |
| CORS bypass | Explicit origin whitelist from env variable |
| Clickjacking | X-Frame-Options: DENY via Helmet |
| Token runaway costs | Per-user daily token budget (50,000 tokens) |

## Accessibility Plan

- Skip-to-content link first in DOM
- ARIA live regions for dynamic updates
- `role`, `aria-label`, `aria-pressed`, `aria-current`, `aria-expanded` throughout
- Keyboard trap management for modals
- `prefers-reduced-motion` respected
- Color contrast ≥ 4.5:1

## Assumptions

1. localStorage is sufficient for prototype data persistence
2. Emission factors are global averages (not location-specific)
3. Users have modern browsers (ES6+ support)
4. Groq free tier is sufficient for demo usage
