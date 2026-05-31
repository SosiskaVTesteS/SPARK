# ============================================================
# SPARK — Деплой системы модерации (Этап 1)
# Запускать из папки проекта: c:\Users\HP\Desktop\spark\SPARK
# ============================================================

$projectRef = "ppehttbtrlavnrytoweu"
$envFile = ".env"

Write-Host ""
Write-Host "=== SPARK Moderation Deploy ===" -ForegroundColor Cyan
Write-Host ""

# --- Читаем ключи из .env ---
$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match "^\s*([^#][^=]+)=(.+)" } | ForEach-Object {
    $parts = $_ -split "=", 2
    $envVars[$parts[0].Trim()] = $parts[1].Trim()
}

$openAiKey = $envVars["OPENAI_API_KEY"]
$geminiKey  = $envVars["GEMINI_API_KEY"]

if (-not $openAiKey) { Write-Host "[ERROR] OPENAI_API_KEY not found in .env" -ForegroundColor Red; exit 1 }
if (-not $geminiKey)  { Write-Host "[ERROR] GEMINI_API_KEY not found in .env"  -ForegroundColor Red; exit 1 }

Write-Host "[1/3] Линкуем проект к Supabase..." -ForegroundColor Yellow
supabase link --project-ref $projectRef

Write-Host ""
Write-Host "[2/3] Устанавливаем секреты в Supabase..." -ForegroundColor Yellow
supabase secrets set OPENAI_API_KEY=$openAiKey
supabase secrets set GEMINI_API_KEY=$geminiKey
Write-Host "Секреты установлены." -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Деплоим Edge Function moderate-content..." -ForegroundColor Yellow
supabase functions deploy moderate-content --project-ref $projectRef
Write-Host "moderate-content задеплоена." -ForegroundColor Green

Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Cyan
Write-Host "Проверь функцию: https://supabase.com/dashboard/project/$projectRef/functions" -ForegroundColor White
Write-Host ""
