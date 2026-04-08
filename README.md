<div align="center">

<img src="public/favicon.svg" alt="Copilot API Logo" width="100" height="100" />

# Copilot API

**Reverse-engineered proxy yang bikin GitHub Copilot bisa dipake sama tools OpenAI/Anthropic**

[![Build Status](https://github.com/el-pablos/copilot-api/actions/workflows/ci.yml/badge.svg)](https://github.com/el-pablos/copilot-api/actions)
[![Version](https://img.shields.io/github/v/release/el-pablos/copilot-api?style=flat-square&color=blue)](https://github.com/el-pablos/copilot-api/releases)
[![License](https://img.shields.io/github/license/el-pablos/copilot-api?style=flat-square&color=green)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-bun_1.2+-f472b6?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[![GitHub Stars](https://img.shields.io/github/stars/el-pablos/copilot-api?style=flat-square&color=yellow)](https://github.com/el-pablos/copilot-api/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/el-pablos/copilot-api?style=flat-square)](https://github.com/el-pablos/copilot-api/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/el-pablos/copilot-api?style=flat-square)](https://github.com/el-pablos/copilot-api/issues)
[![Last Commit](https://img.shields.io/github/last-commit/el-pablos/copilot-api?style=flat-square)](https://github.com/el-pablos/copilot-api/commits)

[Instalasi](#-instalasi) | [Cara Pakai](#-cara-pakai) | [Arsitektur](#-arsitektur) | [API Reference](#-api-reference) | [Konfigurasi](#-konfigurasi)

</div>

---

> **Heads up**: Ini reverse-engineered proxy, bukan official GitHub product. Bisa aja kapan-kapan gak work. Use at your own risk ya!

---

## Apa Itu Copilot API?

Copilot API adalah proxy server yang mentransformasi GitHub Copilot API jadi endpoint yang kompatibel sama OpenAI dan Anthropic. Lo bisa pake Copilot subscription lo sama tools kayak **Cursor**, **Continue**, **Claude Code**, atau aplikasi apapun yang support OpenAI/Anthropic API.

Basically, langganan GitHub Copilot lo jadi lebih "fleksibel" - bisa dipake di berbagai tools AI tanpa perlu bayar lagi.

---

## Tech Stack

<div align="center">

|                                                    Runtime                                                     |                                                      Framework                                                      |                                                                    Language                                                                     |                                                     Build                                                      |
| :------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------: |
| [![Bun](https://img.shields.io/badge/Bun-f472b6?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh) | [![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev) | [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org) | [![tsdown](https://img.shields.io/badge/tsdown-000000?style=for-the-badge)](https://github.com/nicepkg/tsdown) |

</div>

---

## Fitur Utama

| Fitur                     | Deskripsi                                            |
| ------------------------- | ---------------------------------------------------- |
| **Multi-API Support**     | OpenAI Chat Completions & Anthropic Messages API     |
| **Account Pool**          | Rotasi otomatis multi-akun buat ngindarin rate limit |
| **Extended Thinking**     | Support Claude's adaptive thinking dengan 6 levels   |
| **Beautiful Dashboard**   | WebUI mobile-first buat monitoring & config          |
| **Smart Fallback**        | Auto-fallback ke model lain pas kena rate limit      |
| **Request Caching**       | LRU cache yang persist ke disk, hemat quota          |
| **Streaming Support**     | Full streaming support real-time                     |
| **Webhook Notifications** | Discord/Slack alerts buat quota low, errors, dll     |
| **Auto-Rotation**         | Rotasi akun otomatis based on quota/error triggers   |
| **Model Levels**          | Support reasoning effort levels (low sampai xhigh)   |
| **Quota Optimization**    | Route warmup/compact requests ke small model         |

---

## Instalasi

### Prerequisites

- [Bun](https://bun.sh) >= 1.2.x
- GitHub Copilot subscription (Individual/Business/Enterprise)

### Quick Start

```bash
# Clone repo
git clone https://github.com/el-pablos/copilot-api.git
cd copilot-api
bun install

# Authenticate sama GitHub
bun run auth

# Start server (development)
bun run dev

# Atau production mode
bun run start
```

### Install via npm

```bash
# Global install
npm install -g copilot-api

# atau pake bunx langsung
bunx copilot-api
```

Server jalan di `http://localhost:4141`, dashboard juga available di URL yang sama.

---

## Cara Pakai

### Konfigurasi Client

Ganti base URL di aplikasi lo:

**OpenAI-compatible:**

```
Base URL: http://localhost:4141/v1
API Key: ghu_xxxx (atau dummy)
```

**Anthropic-compatible:**

```
Base URL: http://localhost:4141
API Key: ghu_xxxx (atau dummy)
```

### Dengan Claude Code

```bash
# Start server dengan opsi Claude Code
copilot-api start --claude-code

# Atau manual setup
ANTHROPIC_BASE_URL=http://localhost:4141 \
ANTHROPIC_AUTH_TOKEN=dummy \
ANTHROPIC_MODEL=gpt-4.1 \
claude
```

### Dengan OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:4141/v1",
  apiKey: "dummy",
});

const response = await client.chat.completions.create({
  model: "gpt-4.1",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

### Dengan Anthropic SDK

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:4141",
  apiKey: "dummy",
});

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.content);
```

### Model dengan Reasoning Level

Lo bisa pake suffix level buat kontrol reasoning effort:

```bash
# Model dengan level suffix
gpt-5.4(high)          # High reasoning effort
claude-opus-4.6(xhigh) # Extra high reasoning
gpt-5-mini(low)        # Low untuk hemat quota

# Atau pake cus- prefix buat custom request
cus-gpt-4.1            # Custom request tanpa level
```

**Available Levels:** `none`, `minimal`, `low`, `medium`, `high`, `xhigh`

---

## Arsitektur

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients["Client Applications"]
        CC[Claude Code]
        CS[Cursor]
        CT[Continue]
        CA[Custom Apps]
    end

    subgraph CopilotAPI["Copilot API Proxy"]
        direction TB
        HS[Hono Server]

        subgraph Middleware["Middleware Layer"]
            CORS[CORS]
            AUTH[Auth]
            LOG[Logger]
        end

        subgraph Routes["Route Handlers"]
            OAI[OpenAI Routes]
            ANT[Anthropic Routes]
            EMB[Embeddings]
            WEB[WebUI API]
        end

        subgraph Core["Core Services"]
            CACHE[Request Cache]
            QUEUE[Request Queue]
            POOL[Account Pool]
            RATE[Rate Limiter]
        end
    end

    subgraph External["External Services"]
        GH[GitHub OAuth]
        CP[Copilot API]
    end

    Clients --> HS
    HS --> Middleware
    Middleware --> Routes
    Routes --> Core
    Core --> External
```

### Request Pipeline Flow

```mermaid
flowchart LR
    A[Client Request] --> B[Hono Server]
    B --> C{Route?}

    C -->|/v1/chat/completions| D[OpenAI Handler]
    C -->|/v1/messages| E[Anthropic Handler]
    C -->|/v1/embeddings| F[Embeddings Handler]
    C -->|/v1/responses| G[Responses Handler]

    D --> H{Cache Hit?}
    E --> H
    F --> H
    G --> H

    H -->|Yes| M[Return Cached]
    H -->|No| I[Queue System]

    I --> J[Account Pool]
    J --> K[Rate Limiter]
    K --> L[Copilot API]
    L --> N[Transform Response]
    N --> O[Cache & Return]
```

### Account Pool Strategy

```mermaid
flowchart TD
    A[Request Masuk] --> B{Pool Enabled?}
    B -->|No| C[Single Account]
    B -->|Yes| D{Strategy?}

    D -->|sticky| E[Same Account]
    D -->|round-robin| F[Sequential Rotation]
    D -->|quota-based| G[Select by Quota]
    D -->|hybrid| H[Sticky + Auto-Rotate]

    E --> I{Error?}
    F --> I
    G --> I
    H --> I

    I -->|Yes| J[Rotate to Next]
    I -->|No| K[Process Request]
    J --> K

    K --> L{Quota Low?}
    L -->|Yes| M[Send Webhook Alert]
    L -->|No| N[Return Response]
    M --> N
```

### Extended Thinking Flow

```mermaid
flowchart TD
    A[Incoming Request] --> B{Model Check}

    B --> C{Has Thinking Support?}
    C -->|No| D[Standard Request]
    C -->|Yes| E[Check Effort Level]

    E --> F{Effort Level?}
    F -->|none| G[Budget: 0]
    F -->|minimal| H[Budget: 1024]
    F -->|low| I[Budget: 2048]
    F -->|medium| J[Budget: 4096]
    F -->|high| K[Budget: 8192]
    F -->|xhigh| L[Budget: 16384]

    G --> M[Skip Thinking]
    H --> N[Apply Thinking Budget]
    I --> N
    J --> N
    K --> N
    L --> N

    M --> O[Send to Copilot API]
    N --> O

    O --> P[Stream Response]
    P --> Q{Has Thinking Block?}
    Q -->|Yes| R[Extract & Include Thinking]
    Q -->|No| S[Standard Response]
    R --> T[Return to Client]
    S --> T
```

### Data Flow Diagram

```mermaid
flowchart LR
    subgraph Storage["Data Storage"]
        CFG[("config.json")]
        TOK[("github-token.txt")]
        POOL[("pool-state.json")]
        CACHE[("request-cache.json")]
        USAGE[("usage-stats.json")]
    end

    subgraph Runtime["Runtime State"]
        STATE[State Manager]
        TOKEN[Token Manager]
        ACCT[Account Pool]
        RCACHE[Request Cache]
    end

    CFG --> STATE
    TOK --> TOKEN
    POOL --> ACCT
    CACHE --> RCACHE

    STATE --> |"Config changes"| CFG
    TOKEN --> |"Refresh token"| TOK
    ACCT --> |"Pool updates"| POOL
    RCACHE --> |"Cache persist"| CACHE
    USAGE --> |"Track usage"| STATE
```

---

## Struktur Project

```
copilot-api/
├── src/
│   ├── main.ts                # CLI entry point (citty)
│   ├── server.ts              # Hono app + middleware setup
│   ├── start.ts               # Server bootstrap & init
│   ├── auth.ts                # GitHub OAuth flow
│   │
│   ├── lib/                   # Core utilities
│   │   ├── account-pool.ts           # Multi-account management
│   │   ├── account-pool-quota.ts     # Quota tracking
│   │   ├── account-pool-notify.ts    # Webhook notifications
│   │   ├── config.ts                 # File-based config
│   │   ├── request-cache.ts          # LRU caching
│   │   ├── request-queue.ts          # Concurrent handling
│   │   ├── reasoning.ts              # Thinking utilities
│   │   ├── model-level.ts            # Model level parsing
│   │   ├── token.ts                  # Token management
│   │   └── state.ts                  # Runtime state
│   │
│   ├── routes/                # API endpoints
│   │   ├── chat-completions/         # OpenAI /v1/chat/completions
│   │   ├── messages/                 # Anthropic /v1/messages
│   │   ├── embeddings/               # OpenAI /v1/embeddings
│   │   ├── models/                   # GET /models
│   │   ├── responses/                # OpenAI Responses API
│   │   └── ...
│   │
│   ├── services/              # External services
│   │   ├── copilot/                  # GitHub Copilot API client
│   │   └── github/                   # GitHub OAuth & API
│   │
│   └── webui/                 # Dashboard API routes
│
├── public/                    # WebUI frontend (Alpine.js + Tailwind)
├── tests/                     # Test files
└── dist/                      # Build output
```

---

## API Reference

### OpenAI Endpoints

| Endpoint               | Method | Deskripsi                                 |
| ---------------------- | ------ | ----------------------------------------- |
| `/v1/chat/completions` | POST   | Chat completion (streaming/non-streaming) |
| `/v1/embeddings`       | POST   | Text embeddings                           |
| `/v1/models`           | GET    | List available models                     |
| `/v1/models/:id`       | GET    | Get specific model info                   |
| `/v1/responses`        | POST   | OpenAI Responses API                      |

### Anthropic Endpoints

| Endpoint       | Method | Deskripsi              |
| -------------- | ------ | ---------------------- |
| `/v1/messages` | POST   | Anthropic Messages API |

### Utility Endpoints

| Endpoint          | Method | Deskripsi                  |
| ----------------- | ------ | -------------------------- |
| `/health`         | GET    | Health check               |
| `/usage`          | GET    | Usage statistics           |
| `/token`          | GET    | Current Copilot token info |
| `/account-limits` | GET    | Account quota/limits       |

### WebUI API

| Endpoint                    | Method   | Deskripsi                  |
| --------------------------- | -------- | -------------------------- |
| `/`                         | GET      | Dashboard                  |
| `/api/config`               | GET/POST | Get/update configuration   |
| `/api/accounts`             | GET/POST | List/add pool accounts     |
| `/api/accounts/:id`         | DELETE   | Remove account from pool   |
| `/api/cache/stats`          | GET      | Cache statistics           |
| `/api/cache/clear`          | POST     | Clear cache                |
| `/api/logs/stream`          | GET      | Real-time log stream (SSE) |
| `/api/notifications/stream` | GET      | Notification stream (SSE)  |

---

## Konfigurasi

Config file ada di `~/.config/copilot-api/config.json`

### Environment Variables

| Variable                     | Default  | Deskripsi                 |
| ---------------------------- | -------- | ------------------------- |
| `PORT`                       | `4141`   | Server port               |
| `DEBUG`                      | `false`  | Debug logging             |
| `GH_TOKEN`                   | -        | GitHub token              |
| `WEBUI_PASSWORD`             | -        | Password buat WebUI       |
| `HTTP_PROXY`                 | -        | HTTP proxy URL            |
| `HTTPS_PROXY`                | -        | HTTPS proxy URL           |
| `FALLBACK`                   | `false`  | Enable model fallback     |
| `CHAT_COMPLETION_TIMEOUT_MS` | `300000` | Request timeout (5 menit) |

### CLI Options

```bash
copilot-api start [options]

Options:
  -p, --port <port>           Port (default: 4141)
  -v, --verbose               Verbose logging
  -d, --debug                 Debug mode
  -g, --github-token <token>  GitHub token langsung
  -c, --claude-code           Generate Claude Code command
  -f, --fallback              Enable model fallback
  --proxy-env                 Pake HTTP_PROXY/HTTPS_PROXY dari env
  --webui-password <pass>     Set WebUI password
```

### Account Pool Strategies

| Strategy      | Deskripsi                       | Kapan Pake            |
| ------------- | ------------------------------- | --------------------- |
| `sticky`      | Pake akun yang sama sampe error | Default, simple usage |
| `round-robin` | Rotasi berurutan tiap request   | Load balancing rata   |
| `quota-based` | Pilih berdasarkan sisa quota    | Maximize quota usage  |
| `hybrid`      | Sticky + auto-rotate pas error  | **Recommended!**      |

### Contoh Config Lengkap

```json
{
  "port": 4141,
  "debug": false,
  "apiKeys": [],

  "poolEnabled": true,
  "poolStrategy": "hybrid",
  "poolAccounts": [],

  "cacheEnabled": true,
  "cacheMaxSize": 1000,
  "cacheTtlSeconds": 3600,

  "queueEnabled": true,
  "queueMaxConcurrent": 3,
  "queueMaxSize": 100,
  "queueTimeout": 60000,

  "fallbackEnabled": false,
  "modelMapping": {},

  "autoRotationEnabled": true,
  "autoRotationTriggers": {
    "quotaThreshold": 10,
    "errorCount": 3,
    "requestCount": 0
  },
  "autoRotationCooldownMinutes": 30,

  "webhookEnabled": false,
  "webhookProvider": "discord",
  "webhookUrl": "",
  "webhookEvents": {
    "quotaLow": { "enabled": true, "threshold": 10 },
    "accountError": true,
    "rateLimitHit": true,
    "accountRotation": true
  },

  "modelReasoningEfforts": {
    "gpt-5-mini": "low",
    "gpt-5.3-codex": "xhigh",
    "gpt-5.4-mini": "xhigh",
    "gpt-5.4": "xhigh",
    "claude-opus-4.5": "xhigh",
    "claude-sonnet-4.5": "xhigh"
  },

  "smallModel": "gpt-5-mini",
  "compactUseSmallModel": true,
  "warmupUseSmallModel": true,

  "defaultMaxOutputTokens": 32768,
  "maxContextTokensOverride": 0,
  "disableTruncation": false,
  "claudeTokenMultiplier": 1.15,

  "requestTimeoutMs": 300000,
  "trackUsage": true,
  "trackCost": true
}
```

---

## Development

```bash
bun run dev        # Development server (hot reload)
bun run build      # Build project
bun test           # Run tests
bun run lint       # Lint code
bun run typecheck  # Type check
```

### Code Style

- **Imports**: Pake `~/*` alias buat `src/*`
- **Types**: Strict TypeScript, no `any`
- **Naming**: camelCase buat variables, PascalCase buat types
- **Modules**: ESNext only, no CommonJS

---

## Data Storage

| Path                                          | Deskripsi          |
| --------------------------------------------- | ------------------ |
| `~/.config/copilot-api/config.json`           | Configuration      |
| `~/.config/copilot-api/request-cache.json`    | Request cache      |
| `~/.local/share/copilot-api/github-token.txt` | GitHub token       |
| `~/.local/share/copilot-api/pool-state.json`  | Account pool state |
| `~/.local/share/copilot-api/usage-stats.json` | Usage statistics   |

---

## Troubleshooting

### Token expired

```bash
copilot-api auth
```

### Rate limit

1. Enable multi-account pool di dashboard
2. Pake `hybrid` strategy
3. Enable request queue
4. Tambah lebih banyak akun ke pool

### Model not found

1. Check available models: `GET /models`
2. Enable `fallbackEnabled: true`
3. Cek model mapping di config

### Cache issues

```bash
curl -X POST http://localhost:4141/api/cache/clear
```

---

## Kontributor

Makasih buat semua yang udah contribute ke project ini!

<a href="https://github.com/el-pablos/copilot-api/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=el-pablos/copilot-api" />
</a>

### Cara Contribute

1. Fork repo ini
2. Buat branch baru: `git checkout -b feature/nama-fitur`
3. Commit changes: `git commit -m "add: deskripsi singkat"`
4. Push ke branch: `git push origin feature/nama-fitur`
5. Buat Pull Request

---

## License

MIT License - lihat [LICENSE](LICENSE)

---

<div align="center">

**Made with yang penting works**

[![GitHub](https://img.shields.io/badge/GitHub-el--pablos-181717?style=for-the-badge&logo=github)](https://github.com/el-pablos)

</div>
