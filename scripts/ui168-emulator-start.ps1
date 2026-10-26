# UI-168: open Android AVD GUI before sending any browser intent.
# Isolated localhost DEMO. Does not build, install or modify an APK.
param(
 [int]$Port = 4177,
 [string]$AvdName = "A2S_Scola_Phone_Stable",
 [string]$Serial = "emulator-5554"
)
$ErrorActionPreference = "Stop"
$Sdk = "D:\Android\sdk"
$Adb = Join-Path $Sdk "platform-tools\adb.exe"
$Emulator = Join-Path $Sdk "emulator\emulator.exe"
$Base = "http://127.0.0.1:$Port"
if (-not (Test-Path $Adb)) { throw "ADB absent : $Adb" }
if (-not (Test-Path $Emulator)) { throw "Executable de l emulateur absent : $Emulator" }
& $Adb start-server | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Echec du demarrage du service ADB" }

function Get-AndroidDeviceState {
 $rows = & $Adb devices
 if ($LASTEXITCODE -ne 0) { throw "Impossible de lire la liste des appareils ADB" }
 foreach ($line in $rows) {
  if ($line -match ('^' + [regex]::Escape($Serial) + '\s+(device|offline|unauthorized)\s*$')) {
   return $Matches[1]
  }
 }
 return "absent"
}

$state = Get-AndroidDeviceState
if ($state -eq "absent") {
 $avds = @(& $Emulator -list-avds)
 if ($LASTEXITCODE -ne 0) { throw "Impossible de lister les appareils virtuels Android" }
 if ($avds -notcontains $AvdName) {
  throw "AVD '$AvdName' introuvable. Disponibles : $($avds -join ', ')"
 }
 Write-Host "Demarrage de la fenetre Android : $AvdName" -ForegroundColor Cyan
 $started = Start-Process -FilePath $Emulator -ArgumentList @("-avd",$AvdName,"-port","5554") -PassThru
 if ($null -eq $started) { throw "Demarrage de l emulateur non confirme" }
} elseif ($state -eq "offline") {
 Write-Warning "Un appareil $Serial existe mais est hors ligne. Tentative d attente avant toute nouvelle instance."
} elseif ($state -eq "unauthorized") {
 throw "Emulateur non autorise dans ADB : $Serial"
} else {
 Write-Host "Emulateur deja connecte dans ADB : $Serial" -ForegroundColor Green
}

$ready = $false
$deadline = (Get-Date).AddSeconds(180)
while ((Get-Date) -lt $deadline) {
 $state = Get-AndroidDeviceState
 if ($state -eq "device") {
  $boot = (& $Adb -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  if ($boot -eq "1") { $ready = $true; break }
 }
 Start-Sleep -Seconds 2
}
if (-not $ready) {
 throw "Demarrage Android non termine sous 180 secondes. Verifiez Android Studio > Device Manager et la fenetre de l AVD."
}
Write-Host "Android demarre et disponible dans ADB : $Serial" -ForegroundColor Green

# Best effort: bring the top-level emulator window to the foreground if it exists.
$windows = @(Get-Process -Name "emulator","qemu-system-x86_64" -ErrorAction SilentlyContinue |
 Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
if ($windows.Count -gt 0) {
 if (-not ("Ui168Win32" -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Ui168Win32 {
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
 }
 $win = $windows[0]
 [void][Ui168Win32]::ShowWindowAsync($win.MainWindowHandle,9)
 [void][Ui168Win32]::SetForegroundWindow($win.MainWindowHandle)
 Write-Host "Fenetre de l emulateur demandee au premier plan : $($win.ProcessName)"
} else {
 Write-Warning "ADB fonctionne, mais aucune fenetre d emulateur separee n est visible. Verifiez Android Studio > Device Manager (mode integre ou sans fenetre)."
}

& $Adb -s $Serial reverse "tcp:$Port" "tcp:$Port"
if ($LASTEXITCODE -ne 0) { throw "ADB reverse impossible pour TCP $Port" }
Write-Host "Redirection ADB active : $Serial / TCP $Port"
& $Adb -s $Serial shell am start -a android.intent.action.VIEW -d "$Base/?profile=accompagnateur"
if ($LASTEXITCODE -ne 0) { throw "Echec de la commande de lancement du navigateur Android" }
Write-Host "Ouverture du navigateur DEMO demandee sur Android." -ForegroundColor Green
Write-Host "Si le navigateur reste invisible, regardez la fenetre de l AVD ou choisissez le navigateur Android si un selecteur apparait." -ForegroundColor Yellow
