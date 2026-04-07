/**
 * Pretty Logger Module
 * Beautiful terminal output for CLI
 */

import consola from "consola"

// ANSI escape codes untuk colors
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background colors
  bgCyan: "\x1b[46m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  bgMagenta: "\x1b[45m",
  bgBlue: "\x1b[44m",
}

// Unicode symbols
const SYMBOLS = {
  check: "\u2713", // ✓
  cross: "\u2717", // ✗
  bullet: "\u25CF", // ●
  retry: "\u21BB", // ↻
  arrow: "\u279C", // ➜
  pipe: "\u2502", // │
  tee: "\u251C", // ├
  dash: "\u2500", // ─
  star: "\u2605", // ★
  info: "\u2139", // ℹ
  warning: "\u26A0", // ⚠
}

// ASCII Art Logo
const LOGO_ASCII = `
${COLORS.cyan}   ██████╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗${COLORS.reset}
${COLORS.cyan}  ██╔════╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝${COLORS.reset}
${COLORS.cyan}  ██║     ██║   ██║██████╔╝██║██║     ██║   ██║   ██║   ${COLORS.reset}
${COLORS.cyan}  ██║     ██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║   ${COLORS.reset}
${COLORS.cyan}  ╚██████╗╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║   ${COLORS.reset}
${COLORS.cyan}   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   ${COLORS.reset}
${COLORS.dim}                       A P I${COLORS.reset}`

// Startup banner config interface
export interface StartupConfig {
  version: string
  accountCount: number
  activeAccounts: number
  modelCount: number
  port: number
  host?: string
}

/**
 * Print horizontal line separator
 */
function printSeparator(char = SYMBOLS.dash, length = 60): void {
  console.log(`${COLORS.dim}${char.repeat(length)}${COLORS.reset}`)
}

/**
 * Print startup banner dengan ASCII art dan info
 */
export function printStartupBanner(config: StartupConfig): void {
  console.log("")
  console.log(LOGO_ASCII)
  console.log("")
  printSeparator()

  // Version info
  console.log(
    `  ${COLORS.bold}${COLORS.white}Version:${COLORS.reset}  ${COLORS.cyan}v${config.version}${COLORS.reset}`,
  )
  console.log(
    `  ${COLORS.bold}${COLORS.white}Runtime:${COLORS.reset}  ${COLORS.green}Bun${COLORS.reset}`,
  )
  console.log("")

  // Server info
  const host = config.host ?? "localhost"
  console.log(
    `  ${COLORS.bold}${COLORS.white}Server:${COLORS.reset}   ${COLORS.green}http://${host}:${config.port}${COLORS.reset}`,
  )
  console.log("")

  printSeparator()
}

/**
 * Print server ready checklist
 */
export function printServerReady(config: StartupConfig): void {
  console.log("")
  console.log(`  ${COLORS.bold}${COLORS.white}Startup Checklist${COLORS.reset}`)
  console.log("")

  // Checklist items
  const checkIcon = `${COLORS.green}${SYMBOLS.check}${COLORS.reset}`
  const crossIcon = `${COLORS.red}${SYMBOLS.cross}${COLORS.reset}`

  // Accounts status
  const accountIcon = config.activeAccounts > 0 ? checkIcon : crossIcon
  const accountColor = config.activeAccounts > 0 ? COLORS.green : COLORS.yellow
  console.log(
    `  ${accountIcon} ${COLORS.white}Accounts${COLORS.reset}      ${accountColor}${config.activeAccounts}/${config.accountCount} active${COLORS.reset}`,
  )

  // Models status
  const modelIcon = config.modelCount > 0 ? checkIcon : crossIcon
  const modelColor = config.modelCount > 0 ? COLORS.green : COLORS.red
  console.log(
    `  ${modelIcon} ${COLORS.white}Models${COLORS.reset}        ${modelColor}${config.modelCount} available${COLORS.reset}`,
  )

  // Server status
  console.log(
    `  ${checkIcon} ${COLORS.white}Server${COLORS.reset}        ${COLORS.green}Ready on port ${config.port}${COLORS.reset}`,
  )

  console.log("")
  printSeparator()

  // Ready message
  console.log("")
  console.log(
    `  ${COLORS.green}${SYMBOLS.star}${COLORS.reset} ${COLORS.bold}${COLORS.green}Server is ready to accept requests${COLORS.reset}`,
  )
  console.log("")
}

// Request logging entry interface
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

/**
 * Format trace ID untuk display (pendekkan jika terlalu panjang)
 */
function formatTraceId(traceId: string): string {
  if (traceId.length > 8) {
    return traceId.slice(0, 8)
  }
  return traceId
}

/**
 * Format HTTP method dengan warna
 */
function formatMethod(method: string): string {
  const methodColors: Record<string, string> = {
    GET: COLORS.green,
    POST: COLORS.cyan,
    PUT: COLORS.yellow,
    PATCH: COLORS.yellow,
    DELETE: COLORS.red,
  }
  const color = methodColors[method.toUpperCase()] ?? COLORS.white
  return `${color}${method.toUpperCase().padEnd(6)}${COLORS.reset}`
}

/**
 * Format status code dengan warna
 */
function formatStatus(status: number): string {
  let color = COLORS.green
  if (status >= 400 && status < 500) {
    color = COLORS.yellow
  } else if (status >= 500) {
    color = COLORS.red
  }
  return `${color}${status}${COLORS.reset}`
}

/**
 * Format duration dalam ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${COLORS.dim}${ms}ms${COLORS.reset}`
  }
  const seconds = (ms / 1000).toFixed(2)
  return `${COLORS.dim}${seconds}s${COLORS.reset}`
}

/**
 * Format token count
 */
function formatTokens(input?: number, output?: number): string {
  if (input === undefined && output === undefined) {
    return ""
  }
  const parts: Array<string> = []
  if (input !== undefined) {
    parts.push(`${COLORS.dim}in:${COLORS.reset}${input}`)
  }
  if (output !== undefined) {
    parts.push(`${COLORS.dim}out:${COLORS.reset}${output}`)
  }
  return parts.join(" ")
}

/**
 * Log request start
 * Format: [traceId] ● METHOD /path model @account
 */
export function logRequestStart(entry: RequestLogEntry): void {
  const traceId = formatTraceId(entry.traceId)
  const method = formatMethod(entry.method)
  const path = `${COLORS.white}${entry.path}${COLORS.reset}`
  const model = `${COLORS.magenta}${entry.model}${COLORS.reset}`
  const account =
    entry.account ? `${COLORS.dim}@${entry.account}${COLORS.reset}` : ""

  console.log(
    `${COLORS.dim}[${traceId}]${COLORS.reset} ${COLORS.cyan}${SYMBOLS.bullet}${COLORS.reset} ${method} ${path} ${model} ${account}`,
  )
}

/**
 * Log request complete
 * Format: [traceId] ✓/✗ status │ tokens │ duration
 */
export function logRequestComplete(entry: RequestLogEntry): void {
  const traceId = formatTraceId(entry.traceId)
  const isSuccess = entry.status !== undefined && entry.status < 400
  const statusIcon =
    isSuccess ?
      `${COLORS.green}${SYMBOLS.check}${COLORS.reset}`
    : `${COLORS.red}${SYMBOLS.cross}${COLORS.reset}`
  const status = entry.status ? formatStatus(entry.status) : ""
  const tokens = formatTokens(entry.inputTokens, entry.outputTokens)
  const duration = entry.duration ? formatDuration(entry.duration) : ""

  const parts = [status, tokens, duration].filter(Boolean)
  const details = parts.join(` ${COLORS.dim}${SYMBOLS.pipe}${COLORS.reset} `)

  console.log(
    `${COLORS.dim}[${traceId}]${COLORS.reset} ${statusIcon} ${details}`,
  )
}

// Retry log entry interface
export interface RetryLogEntry {
  traceId: string
  attempt: number
  maxAttempts: number
  reason: string
}

/**
 * Log retry attempt
 * Format: [traceId] ↻ Retry attempt/max │ reason
 */
export function logRetry(entry: RetryLogEntry): void {
  const id = formatTraceId(entry.traceId)
  console.log(
    `${COLORS.dim}[${id}]${COLORS.reset} ${COLORS.yellow}${SYMBOLS.retry}${COLORS.reset} Retry ${COLORS.yellow}${entry.attempt}/${entry.maxAttempts}${COLORS.reset} ${COLORS.dim}${SYMBOLS.pipe}${COLORS.reset} ${entry.reason}`,
  )
}

/**
 * Log error
 * Format: [traceId] ✗ error
 */
export function logError(traceId: string, error: string): void {
  const id = formatTraceId(traceId)
  console.log(
    `${COLORS.dim}[${id}]${COLORS.reset} ${COLORS.red}${SYMBOLS.cross}${COLORS.reset} ${COLORS.red}${error}${COLORS.reset}`,
  )
}

/**
 * Log account rotation
 * Format: ↻ Account rotation: from → to
 */
export function logAccountRotation(from: string, to: string): void {
  console.log(
    `${COLORS.yellow}${SYMBOLS.retry}${COLORS.reset} Account rotation: ${COLORS.dim}${from}${COLORS.reset} ${COLORS.yellow}${SYMBOLS.arrow}${COLORS.reset} ${COLORS.green}${to}${COLORS.reset}`,
  )
}

/**
 * Log info message dengan pretty formatting
 */
export function logInfo(message: string): void {
  console.log(`${COLORS.cyan}${SYMBOLS.info}${COLORS.reset} ${message}`)
}

/**
 * Log warning message dengan pretty formatting
 */
export function logWarning(message: string): void {
  console.log(
    `${COLORS.yellow}${SYMBOLS.warning}${COLORS.reset} ${COLORS.yellow}${message}${COLORS.reset}`,
  )
}

/**
 * Log success message dengan pretty formatting
 */
export function logSuccess(message: string): void {
  console.log(
    `${COLORS.green}${SYMBOLS.check}${COLORS.reset} ${COLORS.green}${message}${COLORS.reset}`,
  )
}

/**
 * Print models list dalam format pretty
 */
export function printModelsList(models: Array<string>): void {
  console.log("")
  console.log(
    `  ${COLORS.bold}${COLORS.white}Available Models${COLORS.reset} ${COLORS.dim}(${models.length})${COLORS.reset}`,
  )
  console.log("")

  for (const model of models) {
    console.log(
      `  ${COLORS.dim}${SYMBOLS.tee}${COLORS.reset} ${COLORS.cyan}${model}${COLORS.reset}`,
    )
  }

  console.log("")
}

/**
 * Print usage viewer URL dengan box
 */
export function printUsageViewerUrl(serverUrl: string): void {
  const url = `https://ericc-ch.github.io/copilot-api?endpoint=${serverUrl}/usage`
  consola.box(`Usage Viewer: ${url}`)
}
