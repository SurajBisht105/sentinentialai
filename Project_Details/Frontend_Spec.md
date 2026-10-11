# SentinelAI: Frontend Specification Document

## Overview
This document outlines the frontend architecture and technical specifications for SentinelAI, an enterprise-grade Agentic AI Security Operating System. The application is built using a modern, scalable, and highly interactive stack: **React, Next.js (App Router), TypeScript, and Tailwind CSS**. The UI/UX prioritizes a premium, high-tech, and dynamic aesthetic suitable for an advanced AI security product (incorporating dark mode by default, glassmorphism, smooth micro-interactions, and real-time data visualization).

## 1. Folder Structure
The Next.js App Router paradigm is utilized, structured for modularity and scalability:

```text
/frontend
 /src
   /app                  # Next.js App Router (Pages & Layouts)
     /(auth)             # Authentication routes (Login, SSO, MFA)
     /(dashboard)        # Main dashboard layouts (Guarded routes)
       /projects         # Project management
       /agents           # Live agent orchestration view
       /vulnerabilities  # Vulnerability findings & consensus
       /compliance       # Compliance reports (SOC2, etc.)
      /settings         # User & Tenant settings
       /exploits         # Superadmin only - Exploit Generation module
     /api                # Next.js API Routes (BFF - Backend for Frontend)
   /components
     /ui                 # Reusable generic UI components (Buttons, Inputs, Cards - via  shadcn/ui)
     /layout             # Navigation, Sidebar, Headers
     /features           # Feature-specific components (e.g., AgentGraph, VulnerabilityList)
     /providers          # Context providers (Theme, Auth, Query)
   /hooks                # Custom React hooks
   /lib                  # Utility functions (formatting, validation)
   /store                # Global state management (Zustand)
   /types                # TypeScript interfaces and type definitions
   /services             # API client calls (Axios/Fetch wrappers)
   /styles               # Global CSS, Tailwind configurations, design tokens
```

## 2. Component Architecture
- **Atomic Design Principles:** Components are broken down into Atoms (Icons, Buttons), Molecules (Search bars, Form fields), Organisms (Navigation bars, Data tables), and Templates (Page layouts).
- **Server Components (RSC) vs Client Components:** By default, Next.js components are Server Components. We use `'use client'` only when necessary for interactivity (hooks, state, event listeners).
- **Feature-Driven Architecture:** Complex components are grouped by feature rather than type to improve maintainability (e.g., `/components/features/agent-orchestration/`).

## 3. Route Structure
- `/` - Landing Page (Public)
- `/login` - Authentication Page
- `/dashboard` - Main Overview (Metrics, Active Scans)
- `/dashboard/projects/[id]` - Specific project security posture
- `/dashboard/agents` - Live view of the Agent Ecosystem
- `/dashboard/agents/trace/[id]` - Live terminal/log view for a specific task graph
- `/dashboard/vulnerabilities` - Master list of findings
- `/dashboard/exploits` - **(Superadmin Only)** Exploit Generation module
- `/dashboard/settings` - RBAC, Integrations, and Profiling

## 4. State Management
- **Local State:** `useState` / `useReducer` for component-level UI state (toggles, accordions).
- **Server State (Data Fetching):** **TanStack React Query** is used for caching, syncing, and updating asynchronous server data.
- **Global UI/App State:** **Zustand** is used for lightweight global state management (e.g., Sidebar open/close, active theme, active project context).

## 5. Data Fetching Strategy
- **SSR / SSG:** Next.js Server Components are used for fetching initial data directly on the server to improve load times and SEO.
- **Client-Side Fetching:** React Query handles polling, background updates, and optimistic UI updates for dynamic data (e.g., real-time vulnerability status).
- **WebSockets:** Used for real-time, low-latency streaming of Agent execution logs and task graph progressions to the frontend.

## 6. API Integration
- **Supabase JS Client (`@supabase/supabase-js`):** The primary data client for all database reads/writes. Uses the anon key for RLS-scoped queries and automatically attaches the user's JWT to every request.
- **BFF (Backend for Frontend):** Next.js `/api` routes act as a proxy to the core FastAPI backend for Kafka-driven operations (scan triggering, exploit generation) that require the `service_role` key or internal service access.
- **Axios:** Configured with interceptors for calls to the FastAPI backend. The Supabase session token is automatically injected as the `Authorization: Bearer <token>` header. On `401 Unauthorized` responses, the interceptor calls `supabase.auth.refreshSession()` and retries the request.

## 7. UI Components
- **Core Library:** **shadcn/ui** built on top of Radix UI primitives. It provides accessible, unstyled components that we style with Tailwind CSS.
- **Complex UI:** 
  - **Data Grids:** TanStack Table for sorting, filtering, and pagination of vulnerabilities.
  - **Charts:** Recharts or Tremor for rich, interactive telemetry data and risk metrics.
  - **Graph Visualization:** React Flow to visualize the Multi-Agent Task Graph (Director -> Planner -> Agents).
  - **Code Viewer:** Monaco Editor for viewing vulnerable source code and proposed PR remediations with syntax highlighting and diff views.

## 8. Design System
- **Aesthetic:** Premium, cyber-security focused. Dark mode by default with deep blacks, dark grays, and vibrant neon accents (cyan, purple, emerald) for status indicators.
- **Glassmorphism:** Subtle translucent backgrounds with backdrop-blur for modals, floating sidebars, and dropdowns.
- **Typography:** Modern sans-serif (e.g., `Inter` or `Geist`) for clean, legible data presentation.
- **Spacing & Grids:** Adherence to a strict 8px grid system.

## 9. Responsive Design
- Mobile-first CSS using Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).
- Dashboards utilize CSS Grid and Flexbox to gracefully degrade from multi-column layouts on ultra-wide monitors to single-column stack views on tablets/mobile.
- Data-heavy tables become scrollable or transform into card-based layouts on small screens.

## 10. Accessibility (a11y)
- Radix UI primitives ensure all base components are fully accessible (WAI-ARIA compliant).
- Full keyboard navigation support (focus trapping in modals, skip links).
- Minimum color contrast ratios enforced for all text and UI elements.
- Screen reader support via appropriate `aria-labels` and `role` attributes.

## 11. Error States
- **Global Error Boundary:** Next.js `error.tsx` catches rendering errors to prevent white screens, displaying a styled "Something went wrong" component with a retry button.
- **API Errors:** Toast notifications (via `sonner` or `react-hot-toast`) for non-blocking errors (e.g., "Failed to save settings").
- **Empty States:** Beautifully illustrated empty state components (e.g., "No vulnerabilities found!").

## 12. Loading States
- **Skeletons:** Extensive use of Skeleton loaders matching the exact dimensions of the expected content to prevent layout shift (CLS).
- **Suspense:** React `<Suspense>` boundaries wrap async components for granular loading states.
- **Spinners/Progress:** Indeterminate progress bars at the top of the page for route transitions; circular spinners for localized button actions.

## 13. Authentication UI
- Powered by **Supabase Auth UI** (`@supabase/auth-ui-react`) or a custom implementation using `supabase.auth.signInWithPassword()`, `signInWithOAuth()`, and `signInWithOtp()` methods.
- Sleek, centered login card with OAuth provider buttons (GitHub, Google, Microsoft) and an Email/Password fallback.
- After successful login, Supabase returns a session and the user is redirected to `/dashboard`.
- MFA challenge screen shown after initial authentication for `CISO` and `Superadmin` roles, using `supabase.auth.mfa.challenge()` and `supabase.auth.mfa.verify()`.
- Session expiration is handled automatically by the Supabase SDK (`onAuthStateChange` listener), which triggers a silent token refresh or redirects to `/login` if the refresh token has expired.

## 14. Permissions (RBAC)
- **Client-Side Gating:** A `usePermissions` hook reads `app_metadata.app_role` from the Supabase session object.
- UI elements (e.g., the "Generate Exploit" button) are hidden or disabled if the user lacks the `Superadmin` role.
- **Route Guards:** Next.js Middleware (`middleware.ts`) validates the Supabase session cookie on every request using `@supabase/ssr`, redirecting unauthenticated users to `/login` before the page renders.

## 15. Forms
- **Library:** **React Hook Form** for performant, uncontrolled form state management.
- Complex forms (e.g., configuring compliance scan parameters) are broken down into multi-step wizards with progress indicators.

## 16. Validation
- **Library:** **Zod** is used for schema-based validation.
- Validation schemas are shared between the frontend (React Hook Form resolver) and the Next.js API routes to ensure strict type safety end-to-end.

## 17. Theme Support
- Native Support via `next-themes`.
- Primary focus is on the "Dark Theme", but a clean, high-contrast "Light Theme" is supported for compliance and accessibility requirements.
- CSS Variables managed via Tailwind to easily swap color palettes based on the theme.

## 18. Performance Optimization
- **Code Splitting:** Next.js automatically splits code by route. Dynamic imports (`next/dynamic`) are used for heavy components like Monaco Editor or React Flow.
- **Image Optimization:** `next/image` is used for all static assets to serve WebP formats with proper sizing.
- **Bundle Size:** Strict monitoring of third-party dependencies to ensure the initial JS payload remains minimal.

## 19. Animations
- **Framer Motion:** Used for complex, physics-based micro-interactions.
  - Page transitions (fade in/out).
  - Modal popups with spring animations.
  - Staggered list animations for vulnerability findings.
- **Tailwind Transitions:** Used for simple hover states and color transitions to keep performance high.
- **Terminal Animation:** A custom typewriter effect component for displaying live Agent reasoning logs to give a "hacker/cyber" feel.

## 20. SEO
- **Public Pages:** Full SEO metadata, Open Graph tags, and structured data implemented for the landing page.
- **App Dashboard:** SEO is blocked (`noindex, nofollow`) via `robots.txt` and meta tags for all authenticated routes to ensure security and privacy.

## 21. Testing Strategy
- **Unit/Component Testing:** Vitest and React Testing Library for testing individual UI components and custom hooks.
- **E2E Testing:** Playwright or Cypress for testing critical user flows (Login -> Trigger Scan -> View Finding -> Generate PR).
- **Type Checking:** Strict TypeScript compilation as part of the CI/CD pipeline to catch errors early.
