# Unified Surface — prototype

A single surface over four systems that normally sit apart — **enrollment &
records**, **learning platform**, **student supports**, and **curriculum** — for
a fully virtual K–12 program.

The surface changes shape depending on who signs in, and each person can
rearrange their own view. Everything shown is synthetically generated; this
system contains no real student data.

> **Prototype.** The intent is to make the shape of the product arguable, not to
> ship it. The data model and the adapter seam are meant to survive; the widget
> implementations are not.

---

## Running it

Requires Node 20.9+ and a local PostgreSQL.

```bash
npm install
cp .env.example .env.local          # adjust DATABASE_URL if your Postgres differs
npm run db:push -- --force          # create tables
npm run db:seed                     # generate the synthetic program
npm run dev                         # http://localhost:3000
```

The seed is deterministic (fixed RNG seed), so numbers stay identical between
runs — a rehearsed demo does not change under you. It also anchors every date to
the day you seed, so the data never looks stale.

Other scripts:

| Command | What it does |
|---|---|
| `npm run db:reset` | Re-push schema and re-seed from scratch |
| `npm run licenses` | Fail on any copyleft/source-available dependency |
| `npm run smoke` | Sign in as all five personas, assert every view renders and scope holds |

---

## The demo script

Five accounts on the sign-in screen. Sign in as each; there is deliberately no
"switch user" control, because a visible impersonation toggle invites exactly
the question you don't want ("so teachers can see counselor notes?"). Signing
out and back in answers it structurally instead.

**1. Aisha Bello — learner (grade 11).**
Logs in every day, passing every course, and *20+ points behind pace*. This is
the signal an attendance-based model cannot see. Her view shows the gap and what
to do about it, not a scolding.

**2. Priya Raghunathan — teacher.**
Opens on "Needs your attention" — a ranked action list, not a set of links.
Several learners have not signed in for four or more days; others are below
passing. Note the tile chips: most say *Learning* or *Records*, but the top tile
says **Composed** — it cannot be produced by any single source system. That tile
is the argument for this product existing.

**3. Andre Whitfield — intervention specialist.** *(the core of the demo)*
- **Watchlist** ranks the caseload by composite, lowest first.
- **Maya Okonkwo** sits at the bottom — eight days dark, engagement 12.
- **Diego Ramirez** looks similar at a glance, but his pace is 61 and his
  performance is 69. Open him: engagement collapsed while his coursework stayed
  fine, and there is an **open device request**. The laptop died. Treating that
  as a motivation problem is how a virtual program loses a learner, and no
  conventional dashboard surfaces it.
- **Progress monitoring** shows the goal line against actual — the artifact MTSS
  practitioners actually work from.

**4. Lena Torres — administrator.**
Whole-program indicators, tier distribution, eight-week engagement trend, and
**integration health** showing all four source systems with sync status — one
deliberately degraded, so the tile has something to say.

**5. Carmen Ramirez — parent/guardian.**
Two children, contrasting profiles. Support plans written in plain language
rather than practitioner shorthand. In a virtual program the guardian is the
daily supervisor, so this view is structural, not a courtesy.

**Then, on any account:** press **Customize view** → drag a tile, resize it,
remove one → **sign out** → sign back in. The layout persisted. Locked tiles
refuse to be removed. "Reset to default" restores the role template.

---

## Why the early-warning model is not A-B-C

The standard K–12 early warning framework is **Attendance, Behavior, Course
performance**. It assumes seat time and office discipline referrals. A fully
virtual program has neither.

This prototype uses **Engagement / Pace / Performance** instead:

| Signal | What it reads | Why it matters here |
|---|---|---|
| **Engagement** | login recency, activity, live-session attendance | Days-since-last-login is the strongest virtual dropout predictor. State attendance reporting derives from documented progress and contact — this is that evidence. |
| **Pace** | course completion vs. percent of term elapsed | The defining virtual-school metric, and the one nobody surfaces well. |
| **Performance** | grades, penalised by *rate* of missing work | Rate, not count — taking more courses must not itself register as risk. |

Composite is a weighted blend (0.4 / 0.3 / 0.3) and sets the tier. The **leading
driver** — the lowest of the three — is what makes the number actionable.

**The scores are derived, never assigned.** The seed generates engagement rows,
progress rows and submissions from behavioural archetypes, then computes the
signals from those rows. That is why the administrator's aggregate, the
specialist's caseload list, and a learner's own detail page always reconcile.

---

## Architecture

```
React (Next.js App Router, server components)
        │
   Data access layer  ── role scoping + access log
        │
   Adapter layer  ── SisProvider / LmsProvider / MtssProvider / CurriculumProvider
        │
   PostgreSQL (canonical model + portal config)
```

**The portal is not a system of record.** It is a composition layer. Its own
tables hold layouts, personalization, and the access log; everything substantive
arrives through an adapter.

| Directory | Role |
|---|---|
| `src/db/schema.ts` | Canonical model, shaped against Ed-Fi and 1EdTech rostering |
| `src/db/seed.ts` | Synthetic generation; derives the signals |
| `src/adapters/` | One interface per source system + a mock implementation |
| `src/data/` | Data access layer — authorization lives here, `server-only` |
| `src/widgets/` | Tile implementations and the registry |
| `src/components/` | Design primitives, charts, tile canvas |

### Swapping in a real connector

Write another implementation of the interface in `src/adapters/types.ts` and
change one line in `src/adapters/index.ts`. Nothing above the adapter layer can
observe where data came from. Source systems are named by *function* rather than
by vendor throughout, on purpose.

### Configurability

Layouts are data, not code. Effective layout = **role template** overlaid with
**user personalization**, with **locked** tiles re-asserted from the template on
every read — so an administrator can add a required tile after users have already
personalised and it appears for everyone.

An unknown widget key degrades to nothing rather than crashing the page, because
layout rows can outlive a widget.

---

## FERPA posture

Deliberately structural rather than complete, because the structural parts are
nearly free on day one and expensive to retrofit:

- **Synthetic data only.** Generated, never derived from real records. This is
  most of the compliance story by itself.
- **One authorization choke point.** `src/data/scope.ts` decides who may see
  which learners; nothing above it decides scope. One place to audit.
- **An access record on every detail-level read**, shaped after the disclosure
  record FERPA § 99.32 contemplates — including *denied* attempts, which is
  exactly what an audit wants. It is written by the data layer, not by callers,
  so it cannot be forgotten at a call site. Visible at the bottom of any learner
  page.
- **Optimistic check only at the edge.** `src/proxy.ts` does a cookie presence
  check and nothing more; it never queries.

**Deliberately not built:** consent workflows, directory-information opt-outs,
annual notification, third-party disclosure agreements. Those are product, not
prototype.

---

## Open source posture

- Licensed **Apache-2.0** (the patent grant matters more than MIT for a company).
  Fill in your legal entity in `NOTICE`.
- `npm run licenses` fails on any copyleft or source-available dependency.
  Currently 0 blocked, 5 review — all transitive Next.js build dependencies
  (MPL-2.0 is file-level copyleft and does not reach your code; LGPL via
  dynamically-linked `sharp` is the standard case).
- **No real vendor names anywhere.** Source systems are labelled *Enrollment &
  Records*, *Learning Platform*, *Student Supports*, *Curriculum Library*.
- Entity shapes are modelled against the openly published Ed-Fi data standard and
  the 1EdTech rostering spec. Modelling against a public spec **does not imply
  certification** — that requires membership, and none is claimed.

---

## Known gaps

Honest list of what a reviewer will notice:

- Authentication is a shared demo password against a seeded account list. No
  credential store, no SSO, no password hashing — intentionally.
- Buttons in `Get help`, `Needs your attention` and similar tiles are affordances
  without handlers. Every tile is populated, but not every control acts.
- The administrator's role-template authoring UI is not built; role templates are
  seeded. The three-tier model behind it is real and working.
- Tile spans are responsive at the `lg` breakpoint and stack below it; there is
  no free-form 2D grid.
- Accessibility has had a pass (semantic landmarks, labelled controls, keyboard
  drag via dnd-kit, colour never load-bearing alone) but no audit.
- Chart colours were validated for colour-vision deficiency against this app's
  own surfaces. The tier ramp in charts is deliberately a single blue hue rather
  than green/amber/red — that pair fails separation even for full colour vision,
  so status colours are used only where a text label sits beside them.
