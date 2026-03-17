@echo off
echo.
echo ========================================
echo   Copilot API Proxy - Quota Fix Mode
echo   Branch: all-quota-fix
echo ========================================
echo.
echo Features:
echo [✓] Subagent marker integration (hemat quota)
echo [✓] Native Anthropic Messages API
echo [✓] Smart smallModel fallback (gpt-5-mini)
echo [✓] Compact requests auto-downgrade
echo.

cd /d D:\work\copilot-api
bun run start --port 4141 --verbose
