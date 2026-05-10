# Smoke test per tutte le Edge Functions di Supabase
# Verifica che ogni endpoint risponda con 401 quando non autenticato
# e con 405 su metodi non supportati.
#
# Uso:
#   .\scripts\smoke-test.ps1 -SupabaseUrl "https://xxxx.supabase.co"
#
# Per test autenticati, aggiungere -BearerToken "eyJ..."

param(
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [string]$BearerToken = ""
)

$ErrorActionPreference = "Continue"
$passed  = 0
$failed  = 0
$results = @()

function Invoke-SmokeTest {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int]$ExpectedStatus
  )

  try {
    $params = @{
      Uri             = $Url
      Method          = $Method
      Headers         = $Headers
      UseBasicParsing = $true
      ErrorAction     = "Stop"
    }
    if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }

    $response = Invoke-WebRequest @params
    $actual   = $response.StatusCode
  } catch {
    $actual = $_.Exception.Response.StatusCode.value__
    if (-not $actual) { $actual = 0 }
  }

  $ok = ($actual -eq $ExpectedStatus)
  if ($ok) { $script:passed++ } else { $script:failed++ }

  $script:results += [PSCustomObject]@{
    Result   = if ($ok) { "PASS" } else { "FAIL" }
    Name     = $Name
    Expected = $ExpectedStatus
    Actual   = $actual
  }
}

$base = "$SupabaseUrl/functions/v1"

# ─── Auth headers ────────────────────────────────────────────────────────────

$noAuth  = @{}
$withAuth = if ($BearerToken) { @{ Authorization = "Bearer $BearerToken" } } else { @{} }

# ─── Unauthenticated → must return 401 ───────────────────────────────────────

Write-Host "`n[1/3] Verifica 401 senza autenticazione..." -ForegroundColor Cyan

Invoke-SmokeTest -Name "manage-time-off GET (no auth)"              -Url "$base/manage-time-off"                          -Method GET    -Headers $noAuth -ExpectedStatus 401
Invoke-SmokeTest -Name "manage-time-off POST (no auth)"             -Url "$base/manage-time-off"                          -Method POST   -Headers $noAuth -Body "{}" -ExpectedStatus 401
Invoke-SmokeTest -Name "manage-time-off PATCH (no auth)"            -Url "$base/manage-time-off"                          -Method PATCH  -Headers $noAuth -Body "{}" -ExpectedStatus 401
Invoke-SmokeTest -Name "manage-time-off DELETE (no auth)"           -Url "$base/manage-time-off?request_id=test"          -Method DELETE -Headers $noAuth -ExpectedStatus 401

Invoke-SmokeTest -Name "manage-illness-certificate GET (no auth)"   -Url "$base/manage-illness-certificate"               -Method GET    -Headers $noAuth -ExpectedStatus 401
Invoke-SmokeTest -Name "manage-illness-certificate POST (no auth)"  -Url "$base/manage-illness-certificate"               -Method POST   -Headers $noAuth -Body "{}" -ExpectedStatus 401

Invoke-SmokeTest -Name "get-leave-balance GET (no auth)"            -Url "$base/get-leave-balance?store_id=test"          -Method GET    -Headers $noAuth -ExpectedStatus 401

Invoke-SmokeTest -Name "employee-onboarding GET (no auth)"          -Url "$base/employee-onboarding"                      -Method GET    -Headers $noAuth -ExpectedStatus 401
Invoke-SmokeTest -Name "employee-onboarding POST (no auth)"         -Url "$base/employee-onboarding"                      -Method POST   -Headers $noAuth -Body "{}" -ExpectedStatus 401

Invoke-SmokeTest -Name "publish-shifts POST (no auth)"              -Url "$base/publish-shifts"                           -Method POST   -Headers $noAuth -Body "{}" -ExpectedStatus 401
# generate-optimized-schedule ha verify_jwt=false → raggiunge il codice e ritorna 400 (body assente)
Invoke-SmokeTest -Name "generate-optimized-schedule POST (no auth)"  -Url "$base/generate-optimized-schedule" -Method POST -Headers $noAuth -Body "{}" -ExpectedStatus 400

# ─── Method not allowed (no auth) ────────────────────────────────────────────
# Il gateway Supabase applica JWT check PRIMA del method check → 401 (non 405)

Write-Host "`n[2/3] Verifica comportamento metodi non supportati (no auth)..." -ForegroundColor Cyan

Invoke-SmokeTest -Name "get-leave-balance POST (no auth, gateway 401)"   -Url "$base/get-leave-balance" -Method POST   -Headers $noAuth -Body "{}" -ExpectedStatus 401
Invoke-SmokeTest -Name "get-leave-balance DELETE (no auth, gateway 401)" -Url "$base/get-leave-balance" -Method DELETE -Headers $noAuth -ExpectedStatus 401

# ─── Authenticated tests (only when BearerToken provided) ────────────────────

if ($BearerToken) {
  Write-Host "`n[3/3] Verifica risposte autenticate..." -ForegroundColor Cyan

  # manage-time-off GET senza store_id → 200 con array (dipendente vede le proprie)
  Invoke-SmokeTest -Name "manage-time-off GET (autenticato, dipendente)" -Url "$base/manage-time-off" -Method GET -Headers $withAuth -ExpectedStatus 200

  # get-leave-balance senza store_id → 400
  Invoke-SmokeTest -Name "get-leave-balance GET (manca store_id)"        -Url "$base/get-leave-balance" -Method GET -Headers $withAuth -ExpectedStatus 400

  # employee-onboarding GET → 200 (restituisce preferenze o defaults)
  Invoke-SmokeTest -Name "employee-onboarding GET (autenticato)"         -Url "$base/employee-onboarding" -Method GET -Headers $withAuth -ExpectedStatus 200

  # manage-time-off POST con body mancante → 400
  Invoke-SmokeTest -Name "manage-time-off POST (body vuoto)"             -Url "$base/manage-time-off" -Method POST -Headers $withAuth -Body "{}" -ExpectedStatus 400

  # manage-time-off PATCH senza essere manager → 403
  Invoke-SmokeTest -Name "manage-time-off PATCH (non manager → 403)"     -Url "$base/manage-time-off" -Method PATCH -Headers $withAuth -Body '{"request_id":"00000000-0000-0000-0000-000000000000","action":"approve"}' -ExpectedStatus 403
} else {
  Write-Host "`n[3/3] Test autenticati saltati (nessun -BearerToken fornito)" -ForegroundColor Yellow
}

# --- Report ------------------------------------------------------------------

Write-Host ""
Write-Host "-----------------------------------------"
foreach ($row in $results) {
  $rowColor = if ($row.Result -eq "PASS") { "Green" } else { "Red" }
  $line = "{0,-6} {1,-55} exp={2} got={3}" -f $row.Result, $row.Name, $row.Expected, $row.Actual
  Write-Host $line -ForegroundColor $rowColor
}
Write-Host "-----------------------------------------"
$summaryColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host ("TOTALE: {0} PASS  {1} FAIL" -f $passed, $failed) -ForegroundColor $summaryColor

exit $failed
