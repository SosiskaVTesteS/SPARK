# SPARK — Auto-runner for cyber-judge Edge Function
# Triggered by Windows Task Scheduler every 5 minutes.
# URL source : assets/js/config.js (authoritative frontend config)
# Key source : .env (SUPABASE_SERVICE_ROLE_KEY)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile     = Join-Path $ProjectRoot ".env"
$ConfigJs    = Join-Path $ProjectRoot "assets\js\config.js"
$LogFile     = Join-Path $PSScriptRoot "logs\cyber-judge.log"

# ── Parse .env ──────────────────────────────────────────────────────────────
$envVars = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match "^[A-Z_]+=.+" } | ForEach-Object {
        $parts = $_ -split "=", 2
        $envVars[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# ── Read SUPABASE_URL from config.js (more reliable than .env for this project) ──
$supabaseUrl = $null
if (Test-Path $ConfigJs) {
    $jsContent = Get-Content $ConfigJs -Raw
    if ($jsContent -match "SUPABASE_URL\s*:\s*'(https://[^']+)'") {
        $supabaseUrl = $Matches[1].TrimEnd('/')
    }
}

# Fallback to .env if config.js doesn't have it
if (-not $supabaseUrl) {
    $supabaseUrl = $envVars["SUPABASE_URL"]
}

$serviceKey = $envVars["SUPABASE_SERVICE_ROLE_KEY"]

if (-not $supabaseUrl -or -not $serviceKey) {
    $msg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ERROR] Missing URL or SERVICE_ROLE_KEY"
    Add-Content -Path $LogFile -Value $msg -Encoding utf8
    Write-Host $msg
    exit 1
}

$functionUrl = "$supabaseUrl/functions/v1/cyber-judge"

# ── Call cyber-judge ─────────────────────────────────────────────────────────
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    $response = Invoke-RestMethod `
        -Uri         $functionUrl `
        -Method      POST `
        -Headers     @{
            "Authorization" = "Bearer $serviceKey"
            "apikey"        = $serviceKey
            "Content-Type"  = "application/json"
        } `
        -Body        "{}" `
        -TimeoutSec  35 `
        -ErrorAction Stop

    $verdict = if ($response.verdict)  { $response.verdict  } else { "-" }
    $ideaId  = if ($response.idea_id)  { $response.idea_id  } else { "-" }
    $message = if ($response.message)  { $response.message  } else { "ok" }

    $logLine = "$timestamp [OK] $message idea_id=$ideaId verdict=$verdict"
    Add-Content -Path $LogFile -Value $logLine -Encoding utf8
    Write-Host $logLine

} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    $errMsg     = $_.Exception.Message
    $logLine    = "$timestamp [ERROR] HTTP=$statusCode $errMsg url=$functionUrl"
    Add-Content -Path $LogFile -Value $logLine -Encoding utf8
    Write-Host $logLine
    exit 1
}

# ── Keep log lean: last 500 lines only ───────────────────────────────────────
try {
    $lines = Get-Content $LogFile -ErrorAction SilentlyContinue
    if ($lines -and $lines.Count -gt 500) {
        $lines | Select-Object -Last 500 | Set-Content $LogFile -Encoding utf8
    }
} catch {}
