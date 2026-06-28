# 📣 EchoBoard — Interactive Feedback System

> A lightweight, full-stack feedback platform featuring AJAX-powered live submissions, a REST API, SQLite persistence, and a SOAP Web Service exposing feedback summaries as XML.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Technology Stack](#technology-stack)
5. [Data Flow](#data-flow)
6. [API Reference](#api-reference)
7. [SOAP Web Service](#soap-web-service)
8. [Database Schema](#database-schema)
9. [Setup & Execution](#setup--execution)
10. [Feature Summary](#feature-summary)
11. [Design Decisions](#design-decisions)

---

## Overview

**EchoBoard** is an interactive feedback collection and analysis system built as a multi-file PHP/HTML/CSS/JS web application. Users submit structured feedback (name, category, star rating, message) via an AJAX form — no page reload, no interruption. All entries are persisted in a local SQLite database. The system exposes:

- A **JSON REST API** for submitting, listing, and summarising feedback
- A **SOAP XML Web Service** for querying aggregate summaries via structured XML envelopes

The UI is a single-page dashboard showing live stats, a rating distribution chart, the full feedback feed with category filtering, and an interactive SOAP explorer panel.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                 │
│                                                     │
│  ┌──────────────┐    AJAX/fetch()    ┌────────────┐ │
│  │  index.html  │ ◄────────────────► │  app.js    │ │
│  │  (UI/Form)   │                    │ (AJAX ctrl)│ │
│  └──────────────┘                    └─────┬──────┘ │
└─────────────────────────────────────────────────────┘
                                            │ HTTP JSON/XML
              ┌─────────────────────────────┼───────────────┐
              │           PHP Server        │               │
              │                             ▼               │
              │  ┌──────────────────────────────────────┐   │
              │  │           REST API (api/)            │   │
              │  │  submit.php │ list.php │ summary.php │   │
              │  └──────────────────────┬───────────────┘   │
              │                         │                   │
              │  ┌──────────────────────▼───────────────┐   │
              │  │        SOAP Service (soap/)          │   │
              │  │  service.php (XML envelope response) │   │
              │  └──────────────────────┬───────────────┘   │
              │                         │                   │
              │  ┌──────────────────────▼───────────────┐   │
              │  │       SQLite Database (db/)          │   │
              │  │  echoboard.sqlite  ◄  init.sql       │   │
              │  │  connection.php (PDO helper)         │   │
              │  └──────────────────────────────────────┘   │
              └─────────────────────────────────────────────┘
```

### Layers

| Layer | Role |
|---|---|
| **Frontend** | HTML5 UI + vanilla JS; AJAX via `fetch()` API |
| **REST API** | PHP scripts returning JSON; handles submit, list, summary |
| **SOAP Service** | PHP script wrapping DB data in SOAP 1.1 XML envelopes |
| **Database** | SQLite file; zero-config, file-based persistence via PDO |

---

## File Structure

```
EchoBoard/
│
├── public/                  ← Web root (served by PHP server)
│   ├── index.html           ← Single-page application shell
│   ├── css/
│   │   └── style.css        ← All styles (blue & gold theme)
│   └── js/
│       └── app.js           ← AJAX logic, DOM updates, SOAP viewer
│
├── api/                     ← JSON REST endpoints
│   ├── submit.php           ← POST: create new feedback entry
│   ├── list.php             ← GET: paginated feedback retrieval
│   └── summary.php          ← GET: aggregate statistics
│
├── soap/                    ← SOAP Web Service
│   ├── service.php          ← SOAP envelope builder + method dispatcher
│   └── echoboard.wsdl       ← WSDL descriptor for the service
│
├── db/                      ← Data layer
│   ├── init.sql             ← Schema + seed data (auto-run on first boot)
│   └── connection.php       ← PDO singleton factory
│
└── README.md                ← This document
```

> **Note:** `db/echoboard.sqlite` is created automatically on first request. It is not committed to version control.

---

## Technology Stack

| Component | Technology | Reason |
|---|---|---|
| Frontend UI | HTML5 + CSS3 + Vanilla JS | No build step; instant run |
| AJAX | `fetch()` API (native) | Modern, promise-based, no jQuery dependency |
| Backend | PHP 7.4+ | Ubiquitous, zero-config with built-in server |
| Database | SQLite 3 via PDO | File-based, no server process needed |
| Web Service | Custom SOAP 1.1 (PHP) | Meets XML/SOAP requirement; pure PHP |
| Fonts | Google Fonts (Syne + DM Sans) | Clean, modern typographic pair |

---

## Data Flow

### Feedback Submission (AJAX)

```
User fills form
      │
      ▼
app.js: submitFeedback()
      │
      ▼  POST /api/submit.php  (JSON body)
      │  { name, email, category, rating, message }
      │
      ▼
submit.php:
  1. Validate input (name required, rating 1-5, message required)
  2. Sanitise category against allowlist
  3. INSERT INTO feedback via PDO prepared statement
  4. SELECT newly created row
  5. Return JSON { success: true, feedback: {...} }
      │
      ▼
app.js:
  1. Show toast notification
  2. Reset form
  3. Re-fetch summary stats (loadSummary)
  4. Re-fetch feedback list (loadFeedback)
  — page never reloads —
```

### Feedback Retrieval (AJAX)

```
Page load / filter change
      │
      ▼  GET /api/list.php?category=Product
      │
      ▼
list.php:
  1. Parse query params (limit, offset, category, sort)
  2. Build dynamic WHERE clause with bound params
  3. Return JSON { total, limit, offset, feedback: [...] }
      │
      ▼
app.js: renderFeedback()
  1. Map rows to HTML cards with badges & star strings
  2. Inject into #feedback-list with fade-up animation
```

### SOAP Request Flow

```
User clicks tab in SOAP panel
      │
      ▼  GET /soap/service.php?method=GetSummary
      │
      ▼
service.php:
  1. Parse method from query string or POST body (SOAPAction)
  2. Query SQLite for relevant aggregates
  3. Build XML response body
  4. Wrap in SOAP 1.1 Envelope
  5. Return text/xml
      │
      ▼
app.js: callSoap()
  1. Fetch XML string
  2. Syntax-highlight XML tags and values
  3. Display in monospace panel
```

### Sentiment Calculation

Sentiment is a **generated/computed column** in SQLite — no application code needed:

```sql
CASE
  WHEN rating >= 4 THEN 'positive'
  WHEN rating = 3  THEN 'neutral'
  ELSE                   'negative'
END
```

---

## API Reference

### `POST /api/submit.php`

Submit a new feedback entry.

**Request body (JSON):**
```json
{
  "name":     "Alice",
  "email":    "alice@example.com",
  "category": "Product",
  "rating":   5,
  "message":  "Fantastic experience!"
}
```

**Response (success):**
```json
{
  "success": true,
  "feedback": {
    "id": 6,
    "name": "Alice",
    "email": "alice@example.com",
    "category": "Product",
    "rating": 5,
    "message": "Fantastic experience!",
    "sentiment": "positive",
    "created_at": "2025-01-15 10:30:00"
  }
}
```

**Response (validation error):**
```json
{ "success": false, "errors": ["Name is required.", "Rating must be between 1 and 5."] }
```

---

### `GET /api/list.php`

Retrieve paginated feedback.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 20 | Max rows (cap: 100) |
| `offset` | int | 0 | Pagination offset |
| `category` | string | — | Filter by category |
| `sort` | asc\|desc | desc | Date sort order |

**Response:**
```json
{
  "total": 12,
  "limit": 20,
  "offset": 0,
  "feedback": [ { "id":1, "name":"...", ... } ]
}
```

---

### `GET /api/summary.php`

Returns aggregate statistics.

**Response:**
```json
{
  "generated_at": "2025-01-15T10:30:00+00:00",
  "totals": {
    "total_count": 12,
    "avg_rating": 3.83,
    "positive": 7,
    "neutral": 2,
    "negative": 3
  },
  "by_category": [ { "category": "Product", "count": 4, "avg_rating": 4.5 } ],
  "by_rating":   [ { "rating": 1, "count": 1 }, ... ],
  "recent":      [ { "id": 12, "name": "...", ... } ]
}
```

---

## SOAP Web Service

**Endpoint:** `GET|POST /soap/service.php`

**WSDL:** `/soap/echoboard.wsdl`

### Methods

#### `GetSummary`
Returns overall aggregate counts and average rating.

```
GET /soap/service.php?method=GetSummary
```

**Response envelope (excerpt):**
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:echo="http://echoboard.local/soap">
  <soapenv:Body>
    <echo:GetSummaryResponse>
      <summary>
        <totalFeedback>12</totalFeedback>
        <averageRating>3.83</averageRating>
        <positiveCount>7</positiveCount>
        <neutralCount>2</neutralCount>
        <negativeCount>3</negativeCount>
        <generatedAt>2025-01-15T10:30:00+00:00</generatedAt>
      </summary>
    </echo:GetSummaryResponse>
  </soapenv:Body>
</soapenv:Envelope>
```

#### `GetFeedbackList`
Returns the most recent feedback entries (default 10, max 50).

```
GET /soap/service.php?method=GetFeedbackList&limit=5
```

#### `GetCategorySummary`
Returns per-category breakdown with counts and averages.

```
GET /soap/service.php?method=GetCategorySummary
```

### Calling via POST (proper SOAP client)

```xml
POST /soap/service.php
Content-Type: text/xml
SOAPAction: "http://echoboard.local/soap/GetSummary"

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:echo="http://echoboard.local/soap">
  <soapenv:Header/>
  <soapenv:Body>
    <echo:GetSummary/>
  </soapenv:Body>
</soapenv:Envelope>
```

---

## Database Schema

```sql
CREATE TABLE feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT,
    category    TEXT NOT NULL DEFAULT 'General',
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    message     TEXT NOT NULL,
    sentiment   TEXT GENERATED ALWAYS AS (
                    CASE
                        WHEN rating >= 4 THEN 'positive'
                        WHEN rating = 3  THEN 'neutral'
                        ELSE 'negative'
                    END
                ) STORED,
    created_at  DATETIME DEFAULT (datetime('now'))
);
```

**Key design choices:**
- `sentiment` is a **generated column** — always consistent, zero application logic required
- `rating CHECK` constraint enforces 1–5 at the database level
- PDO **prepared statements** used throughout to prevent SQL injection
- SQLite chosen for portability — no installation, single file, zero config

---

## Setup & Execution

### Prerequisites

- **PHP 7.4+** with SQLite extension enabled (`php -m | grep sqlite`)
- No Composer, no npm, no build tools required

### Steps

```bash
# 1. Clone or unzip the project
cd EchoBoard

# 2. Start the PHP built-in server from the project root
php -S localhost:8000

# 3. Open in browser
open http://localhost:8000/public/index.html
```

> The SQLite database (`db/echoboard.sqlite`) is created **automatically** on the first request. Seed data from `db/init.sql` is loaded if the file is fresh.

### Verify SOAP directly

```bash
# GetSummary
curl "http://localhost:8000/soap/service.php?method=GetSummary"

# GetFeedbackList
curl "http://localhost:8000/soap/service.php?method=GetFeedbackList&limit=3"

# GetCategorySummary
curl "http://localhost:8000/soap/service.php?method=GetCategorySummary"
```

### Reset the database

```bash
rm db/echoboard.sqlite
# Restart server — fresh DB with seed data recreated automatically
```

---

## Feature Summary

| Feature | Implementation |
|---|---|
| AJAX form submit | `fetch()` POST to `/api/submit.php`, JSON response |
| Live stats update | Re-fetches `/api/summary.php` after every submission |
| No page reload | All DOM updates via JavaScript, zero navigation |
| Rating distribution | Animated bar chart built from summary API data |
| Category filter | Dropdown triggers new AJAX request with `?category=` |
| Sentiment badges | Computed in DB, displayed as colour-coded badges |
| SOAP XML service | 3 methods: GetSummary, GetFeedbackList, GetCategorySummary |
| WSDL descriptor | `/soap/echoboard.wsdl` documents the service contract |
| SQL injection protection | PDO prepared statements throughout |
| Input validation | Server-side: required fields, rating range, category allowlist |
| Seed data | 5 realistic entries auto-loaded on first run |
| Toast notifications | Non-blocking success/error messages |
| Responsive layout | CSS Grid with mobile breakpoints |

---

## Design Decisions

**Why SQLite?**
SQLite requires no installation or configuration. It runs as a library, stores everything in a single `.sqlite` file, and is accessed via PHP's native PDO. Ideal for assignment projects and demos.

**Why vanilla JS instead of a framework?**
Keeps the project dependency-free and demonstrates core AJAX concepts (`fetch`, promise chains, DOM manipulation) without abstraction. No build step, no `node_modules`.

**Why a custom SOAP implementation instead of PHP's `SoapServer` class?**
PHP's `SoapServer` requires a strict WSDL and can be brittle with SQLite. The custom XML envelope approach produces identical compliant SOAP 1.1 output with full visibility into the XML structure — more instructive for a coursework context, and still fully WSDL-described.

**Why a generated column for sentiment?**
It guarantees the sentiment value is always consistent with the rating — no possibility of drift between application writes. It also means any direct DB insert automatically gets the correct sentiment without needing application logic.

---

*EchoBoard — built for clarity, runs on nothing but PHP.*

---

## Author

Developed as an academic project to demonstrate desktop application.
