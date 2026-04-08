<div align="center">

<img src="public/favicon.svg" alt="Copilot API Logo" width="120" height="120" />

# Copilot API

**Reverse-engineered proxy yang bikin GitHub Copilot bisa dipake sama tools OpenAI/Anthropic**

[![Build Status](https://github.com/el-pablos/copilot-api/actions/workflows/ci.yml/badge.svg)](https://github.com/el-pablos/copilot-api/actions)
[![Version](https://img.shields.io/github/v/release/el-pablos/copilot-api?style=flat-square)](https://github.com/el-pablos/copilot-api/releases)
[![License](https://img.shields.io/github/license/el-pablos/copilot-api?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-bun-f472b6?style=flat-square)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[Instalasi](#instalasi) | [Cara Pakai](#cara-pakai) | [Arsitektur](#arsitektur) | [API Reference](#api-reference) | [Konfigurasi](#konfigurasi)

</div>

---

> **Heads up**: Ini reverse-engineered proxy, bukan official GitHub product. Bisa aja kapan-kapan gak work. Use at your own risk ya!

---

## Deskripsi

Copilot API adalah proxy server yang mentransformasi GitHub Copilot API jadi endpoint yang kompatibel sama OpenAI dan Anthropic. Lo bisa pake Copilot subscription lo sama tools kayak Cursor, Continue, Claude Code, atau aplikasi apapun yang support OpenAI/Anthropic API.

Basically, langganan GitHub Copilot lo jadi lebih "fleksibel" - bisa dipake di berbagai tools AI tanpa perlu bayar lagi.

### Fitur Utama

| Fitur                     | Deskripsi                                          |
| ------------------------- | -------------------------------------------------- |
| **Multi-API Support**     | OpenAI Chat Completions & Anthropic Messages API   |
| **Account Pool**          | Rotasi otomatis buat ngindarin rate limit          |
| **Extended Thinking**     | Support Claude's adaptive thinking dengan levels   |
| **Beautiful Dashboard**   | WebUI mobile-first buat monitoring & config        |
| **Smart Fallback**        | Auto-fallback ke model lain pas kena rate limit    |
| **Request Caching**       | LRU cache yang persist ke disk, hemat quota        |
| **Streaming Support**     | Full streaming support real-time                   |
| **Webhook Notifications** | Discord/Slack alerts buat quota low, errors, dll   |
| **Auto-Rotation**         | Rotasi akun otomatis based on quota/error triggers |
| **Model Levels**          | Support reasoning effort levels (low sampai xhigh) |
| **Quota Optimization**    | Route warmup/compact requests ke small model       |

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
  apiKey: "dummy", // API key gak dipake, tapi required
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

### Dengan curl

```bash
# Chat completion (OpenAI format)
curl http://localhost:4141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Messages (Anthropic format)
curl http://localhost:4141/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
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

### Request Flow

```mermaid
flowchart LR
    A[Client] --> B[Hono Server]
    B --> C{Route}
    C -->|/v1/chat/completions| D[OpenAI Handler]
    C -->|/v1/messages| E[Anthropic Handler]
    C -->|/v1/embeddings| F[Embeddings Handler]
    C -->|/v1/responses| G[Responses Handler]
    D --> H[Cache Check]
    E --> H
    F --> H
    G --> H
    H -->|Hit| M[Client]
    H -->|Miss| I[Queue System]
    I --> J[Account Pool]
    J --> K[Rate Limiter]
    K --> L[Copilot API]
    L --> N[Response Transform]
    N --> M
```

### Account Pool Flow

```mermaid
flowchart TD
    A[Request Masuk] --> B{Pool Enabled?}
    B -->|No| C[Pake Single Account]
    B -->|Yes| D{Strategy?}
    D -->|sticky| E[Akun yang Sama]
    D -->|round-robin| F[Rotasi Berurutan]
    D -->|quota-based| G[Pilih by Quota]
    D -->|hybrid| H[Sticky + Auto-Rotate]
    E --> I{Error?}
    F --> I
    G --> I
    H --> I
    I -->|Yes| J[Auto-Rotate ke Akun Lain]
    I -->|No| K[Proses Request]
    J --> K
    K --> L[Return Response]
```

### Struktur Direktori

```
copilot-api/
├── src/
│   ├── main.ts           # CLI entry point (citty)
│   ├── server.ts         # Hono app setup + middleware
│   ├── start.ts          # Server bootstrap & initialization
│   ├── auth.ts           # GitHub OAuth flow
│   │
│   ├── lib/              # Core utilities
│   │   ├── account-pool.ts        # Multi-account management
│   │   ├── account-pool-quota.ts  # Quota tracking & refresh
│   │   ├── account-pool-notify.ts # Webhook notifications
│   │   ├── config.ts              # File-based config
│   │   ├── request-cache.ts       # LRU caching
│   │   ├── request-queue.ts       # Concurrent request handling
│   │   ├── reasoning.ts           # Thinking/reasoning utilities
│   │   ├── model-level.ts         # Model level parsing
│   │   ├── token.ts               # Token management
│   │   ├── state.ts               # Runtime state
│   │   └── ...
│   │
│   ├── routes/           # API endpoints
│   │   ├── chat-completions/      # OpenAI /v1/chat/completions
│   │   ├── messages/              # Anthropic /v1/messages
│   │   ├── embeddings/            # OpenAI /v1/embeddings
│   │   ├── models/                # GET /models
│   │   ├── responses/             # OpenAI Responses API
│   │   ├── health/                # Health check
│   │   ├── usage/                 # Usage statistics
│   │   ├── token/                 # Token info
│   │   └── account-limits/        # Account quota/limits
│   │
│   ├── services/         # External services
│   │   ├── copilot/               # GitHub Copilot API client
│   │   └── github/                # GitHub OAuth & API
│   │
│   └── webui/            # Dashboard API routes
│
├── public/               # WebUI frontend (Alpine.js + Tailwind)
├── tests/                # Test files
└── dist/                 # Build output
```

### Account Pool Strategies

| Strategy      | Deskripsi                       | Kapan Pake            |
| ------------- | ------------------------------- | --------------------- |
| `sticky`      | Pake akun yang sama sampe error | Default, simple usage |
| `round-robin` | Rotasi berurutan tiap request   | Load balancing rata   |
| `quota-based` | Pilih berdasarkan sisa quota    | Maximize quota usage  |
| `hybrid`      | Sticky + auto-rotate pas error  | **Recommended!**      |

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

### Konfigurasi Detail

#### Auto-Rotation Settings

| Key                                   | Type    | Default | Deskripsi                                 |
| ------------------------------------- | ------- | ------- | ----------------------------------------- |
| `autoRotationEnabled`                 | boolean | `true`  | Enable auto-rotation pas error            |
| `autoRotationTriggers.quotaThreshold` | number  | `10`    | Rotate kalau quota di bawah X%            |
| `autoRotationTriggers.errorCount`     | number  | `3`     | Rotate setelah X error berturut-turut     |
| `autoRotationTriggers.requestCount`   | number  | `0`     | Rotate setiap X request (0 = disabled)    |
| `autoRotationCooldownMinutes`         | number  | `30`    | Minimum waktu antar auto-rotation (menit) |

#### Webhook Notifications

| Key                             | Type    | Default   | Deskripsi                              |
| ------------------------------- | ------- | --------- | -------------------------------------- |
| `webhookEnabled`                | boolean | `false`   | Enable webhook notifications           |
| `webhookProvider`               | string  | `discord` | Provider: `discord`, `slack`, `custom` |
| `webhookUrl`                    | string  | `""`      | Webhook URL                            |
| `webhookEvents.quotaLow`        | object  | -         | Notify kalau quota rendah              |
| `webhookEvents.accountError`    | boolean | `true`    | Notify kalau akun error                |
| `webhookEvents.rateLimitHit`    | boolean | `true`    | Notify kalau kena rate limit           |
| `webhookEvents.accountRotation` | boolean | `true`    | Notify kalau akun di-rotate            |

#### Quota Optimization

| Key                    | Type    | Default      | Deskripsi                                |
| ---------------------- | ------- | ------------ | ---------------------------------------- |
| `smallModel`           | string  | `gpt-5-mini` | Model untuk warmup/compact (hemat quota) |
| `compactUseSmallModel` | boolean | `true`       | Route compact requests ke small model    |
| `warmupUseSmallModel`  | boolean | `true`       | Route warmup requests ke small model     |

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

### Testing

```bash
bun test                           # Run all tests
bun test tests/specific.test.ts    # Run single test file
bun test --coverage                # Run dengan coverage
bun test --watch                   # Watch mode
```

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

### Account pool tidak jalan

1. Pastikan `poolEnabled: true` di config
2. Minimal ada 1 akun di pool
3. Cek status akun di dashboard (`/api/accounts`)

### Quota habis

1. Tambah akun baru ke pool
2. Enable auto-rotation
3. Pake `quota-based` atau `hybrid` strategy
4. Route non-essential requests ke small model

### Webhook tidak terkirim

1. Verifikasi `webhookUrl` valid
2. Pastikan `webhookEnabled: true`
3. Cek specific events enabled di `webhookEvents`

---

## Kontributor

<a href="https://github.com/el-pablos/copilot-api/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=el-pablos/copilot-api" />
</a>

---

## License

MIT License - lihat [LICENSE](LICENSE)

---

<div align="center">

**Made with yang penting works di Indonesia**

</div>
