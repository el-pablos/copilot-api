/**
 * Pretty Logger Module - Beautiful terminal output
 */
import consola from "consola"

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
}

const LOGO = `
${c.magenta}   ██████╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗${c.reset}
${c.magenta}  ██╔════╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝${c.reset}
${c.magenta}  ██║     ██║   ██║██████╔╝██║██║     ██║   ██║   ██║   ${c.reset}
${c.magenta}  ██║     ██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║   ${c.reset}
${c.magenta}  ╚██████╗╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║   ${c.reset}
${c.magenta}   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   ${c.reset}
${c.dim}                       A P I${c.reset}
`

export interface StartupConfig {
  version: string
  accountCount: number
  activeAccounts: number
  modelCount: number
  port: number
  host?: string
}

export function printStartupBanner(config: StartupConfig): void {
  console.log(LOGO)
  const info = [
    `${c.dim}Version:${c.reset} ${c.white}${config.version}${c.reset}`,
    `${c.dim}Accounts:${c.reset} ${c.green}${config.activeAccounts}/${config.accountCount}${c.reset}`,
    `${c.dim}Models:${c.reset} ${c.cyan}${config.modelCount}${c.reset}`,
  ].join("  |  ")
  console.log(`  ${info}\n`)
}

export function printServerReady(
  checks: Array<{ label: string; ok: boolean }>,
  urls: { local: string; network?: string },
): void {
  for (const { label, ok } of checks) {
    const icon = ok ? `${c.green}✓${c.reset}` : `${c.red}✕${c.reset}`
    console.log(`  ${icon} ${label}`)
  }
  console.log()
  console.log(
    `  ${c.cyan}➜${c.reset}  Local:   ${c.cyan}${urls.local}${c.reset}`,
  )
  if (urls.network) {
    console.log(
      `  ${c.dim}➜${c.reset}  Network: ${c.dim}${urls.network}${c.reset}`,
    )
  }
  console.log()
}

export interface RequestLogEntry {
  traceId: string
  method: string
  path: string
  model: string
  account?: string
  status?: number
  duration?: number
  inputTokens?: number
  outputTokens?: number
}

export function logRequestStart(entry: RequestLogEntry): void {
  const tid = `${c.dim}[${entry.traceId.slice(0, 6)}]${c.reset}`
  const method = `${c.cyan}${entry.method}${c.reset}`
  const model = `${c.magenta}${entry.model}${c.reset}`
  const account = entry.account ? `${c.dim}@${entry.account}${c.reset}` : ""
  console.log(
    `${tid} ${c.yellow}●${c.reset} ${method} ${entry.path} ${model}${account}`,
  )
}

export function logRequestComplete(entry: RequestLogEntry): void {
  const tid = `${c.dim}[${entry.traceId.slice(0, 6)}]${c.reset}`
  const statusColor = entry.status && entry.status < 400 ? c.green : c.red
  const statusIcon = entry.status && entry.status < 400 ? "✓" : "✕"
  const status = `${statusColor}${statusIcon} ${entry.status || "ERR"}${c.reset}`
  const parts = [status]
  if (entry.inputTokens && entry.outputTokens)
    parts.push(`${c.dim}${entry.inputTokens}→${entry.outputTokens}${c.reset}`)
  if (entry.duration) parts.push(`${c.dim}${entry.duration}ms${c.reset}`)
  console.log(`${tid} ${parts.join(" | ")}`)
}

interface RetryOptions {
  traceId: string
  attempt: number
  maxAttempts: number
  reason: string
}

export function logRetry(options: RetryOptions): void {
  const { traceId, attempt, maxAttempts, reason } = options
  const tid = `${c.dim}[${traceId.slice(0, 6)}]${c.reset}`
  console.log(
    `${tid} ${c.yellow}↻${c.reset} Retry ${attempt}/${maxAttempts} | ${c.dim}${reason}${c.reset}`,
  )
}

export function logError(traceId: string, error: string): void {
  const tid = `${c.dim}[${traceId.slice(0, 6)}]${c.reset}`
  console.log(`${tid} ${c.red}✕${c.reset} ${c.red}${error}${c.reset}`)
}

export function logAccountRotation(from: string, to: string): void {
  console.log(
    `${c.yellow}↻${c.reset} Account rotation: ${c.dim}${from}${c.reset} → ${c.cyan}${to}${c.reset}`,
  )
}

/**
 * Print usage viewer URL dengan box
 */
export function printUsageViewerUrl(serverUrl: string): void {
  const url = `https://ericc-ch.github.io/copilot-api?endpoint=${serverUrl}/usage`
  consola.box(`Usage Viewer: ${url}`)
}

/**
 * Print models list dengan formatting
 */
export function printModelsList(models: Array<string>): void {
  console.log(
    `  ${c.bold}${c.white}Available Models${c.reset} ${c.dim}(${models.length})${c.reset}\n`,
  )
  for (const model of models) {
    console.log(`  ${c.dim}├${c.reset} ${c.cyan}${model}${c.reset}`)
  }
  console.log()
}
