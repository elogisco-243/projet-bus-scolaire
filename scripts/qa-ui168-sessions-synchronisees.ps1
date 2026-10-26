# A2S Scola UI-168: DEMO browser sessions for Parent/Supervisor/Driver/Attendant.
# Loopback only. No production APK, real pupils, hosted deployment, database or credentials.
param(
 [switch]$NoBrowser,
 [switch]$OpenAndroidEmulator
)
$ErrorActionPreference = "Stop"
$Project = "D:\A2S-Scola-UI153-Phone"
$Branch = "feature/bus-v3-sync18-attendant-qa"
$Port = 4177
$Base = "http://127.0.0.1:$Port"
$Source = "$Project\mobile-session21\demo-hub.mjs"
Set-Location $Project
$Current = (git branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $Current -ne $Branch) {
 throw "Branche incorrecte. Attendue : $Branch ; actuelle : $Current"
}
if (-not (Test-Path $Source)) { throw "Module UI-168 absent. Executez d abord git pull." }
$Node = (Get-Command node -ErrorAction Stop).Source
$VersionMajor = [int](& $Node -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or $VersionMajor -lt 22) { throw "Node.js version 22 minimum requise" }
Write-Host "=== TESTS UI-168 : QUATRE PROFILS DEMO ===" -ForegroundColor Cyan
& $Node --test ".\test\v3-ui167-coordination.test.mjs" ".\test\v3-ui168-synchronized-profiles.test.mjs"
if ($LASTEXITCODE -ne 0) { throw "Tests de synchronisation echoues ; aucun serveur lance" }
$Folder = Join-Path $Project "Captures-UI168"
New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$Sheet = Join-Path $Folder "Recette-synchronisee-UI168.csv"
if (-not (Test-Path $Sheet)) {
 @(
  [pscustomobject]@{Scenario="Preparation Accompagnateur puis demarrage Chauffeur";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Demande Parent visible chez Superviseur sans modifier l arret";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Approbation Superviseur visible chez Parent et Accompagnateur";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Refus Superviseur laisse l ancien arret intact";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Une remise sans revue ne fonctionne pas";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Pointage, feu vert et reprise Chauffeur";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Incident critique bloque le depart";Observe="";Resultat="";Commentaires=""}
  [pscustomobject]@{Scenario="Reconnexion navigateur et reprise du meme etat";Observe="";Resultat="";Commentaires=""}
 ) | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $Sheet
}
$Healthy = $false
try {
 $Health = Invoke-RestMethod "$Base/api/health" -TimeoutSec 2
 if ($Health.mode -eq "DEMO_ONLY") { $Healthy = $true }
 else { throw "Port 4177 occupe par un autre service" }
} catch {
 if ($_.Exception.Message -match 'Port 4177 occupe') { throw }
}
$Process = $null
if (-not $Healthy) {
 $Stdout = Join-Path $Folder "Serveur-UI168.stdout.log"
 $Stderr = Join-Path $Folder "Serveur-UI168.stderr.log"
 $Process = Start-Process -FilePath $Node -ArgumentList @($Source) -WorkingDirectory $Project -PassThru -WindowStyle Hidden -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr
 for($i=0;$i -lt 30;$i++){
  Start-Sleep -Milliseconds 250
  if ($Process.HasExited) { throw "Le serveur s est arrete. Voir $Stderr" }
  try {
    $Health = Invoke-RestMethod "$Base/api/health" -TimeoutSec 2
    if ($Health.mode -eq "DEMO_ONLY") { $Healthy = $true; break }
  } catch {}
 }
 if (-not $Healthy) { throw "Serveur local UI-168 indisponible. Voir $Stderr" }
}
Write-Host "=== UI-168 : SESSIONS SYNCHRONISEES DEMO PRETES ===" -ForegroundColor Green
Write-Host "Serveur HTTP LOCAL UNIQUEMENT : $Base"
Write-Host "Chauffeur      : $Base/?profile=chauffeur"
Write-Host "Accompagnateur : $Base/?profile=accompagnateur"
Write-Host "Parent E-01    : $Base/?profile=parent"
Write-Host "Parent E-02    : $Base/?profile=parent2"
Write-Host "Superviseur    : $Base/?profile=superviseur"
Write-Host "Fiche de tests : $Sheet"
if ($Process) {
 Write-Host "PID du serveur DEMO : $($Process.Id)"
 Write-Host "Pour le fermer : Stop-Process -Id $($Process.Id)"
}
if (-not $NoBrowser) {
 foreach ($role in @("chauffeur","accompagnateur","parent","superviseur")) {
  Start-Process "$Base/?profile=$role"
 }
 Write-Host "Quatre onglets ouverts dans le navigateur Windows." -ForegroundColor Cyan
}
if ($OpenAndroidEmulator) {
 $Helper = Join-Path $Project "scripts\ui168-emulator-start.ps1"
 if (-not (Test-Path $Helper)) { throw "Lanceur AVD UI-168 absent. Executez git pull." }
 & $Helper -Port $Port
}
Write-Host "DEMO UNIQUEMENT : profils choisis librement, sans identite reelle ni badge verifie." -ForegroundColor Yellow
Write-Host "Les actions des quatre onglets partagent une seule tournee en memoire." -ForegroundColor Yellow
