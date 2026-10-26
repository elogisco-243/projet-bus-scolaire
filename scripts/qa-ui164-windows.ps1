# A2S Scola UI-164. Strictly isolated Accompagnateur DEMO Android 16.
# Run after updating the feature branch. No Chauffeur v1.7, Render or live DB mutation.
$ErrorActionPreference = "Stop"
& {
    $Project = "D:\A2S-Scola-UI153-Phone"
    $Branch = "feature/bus-v3-sync18-attendant-qa"
    $Sdk = "D:\Android\sdk"
    $ExpectedAvd = "A2S_Scola_Phone_Stable"
    $Package = "cd.eneo360.busscolaire.v3.sync09.test"
    $env:ANDROID_HOME = $Sdk
    $env:ANDROID_SDK_ROOT = $Sdk
    $env:ANDROID_AVD_HOME = "D:\Android\avd"
    $env:GRADLE_USER_HOME = "D:\Android\gradle-home"
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    Set-Location $Project
    $ActualBranch = (git branch --show-current | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $ActualBranch -ne $Branch) { throw "Branche Git non autorisee : $ActualBranch" }
    Write-Host "=== TESTS AUTOMATISES UI-164 ===" -ForegroundColor Cyan
    $Tests = @(
      ".\test\v3-sync18-attendant.test.mjs",
      ".\test\v3-sync19-attendant-demo.test.mjs",
      ".\test\v3-ui153-attendant-layout.test.mjs",
      ".\test\v3-ui154-attendant.test.mjs",
      ".\test\v3-ui155-attendant.test.mjs",
      ".\test\v3-ui156-attendant-indicators.test.mjs",
      ".\test\v3-ui157-chauffeur-alignment.test.mjs",
      ".\test\v3-ui158-simple-driver-flow.test.mjs",
      ".\test\v3-ui159-side-by-side-safety.test.mjs",
      ".\test\v3-ui159-adversarial-invariants.test.mjs",
      ".\test\v3-ui160-driver-parity-contract.test.mjs",
      ".\test\v3-ui161-current-stop-pointage.test.mjs",
      ".\test\v3-ui162-parent-stop-change.test.mjs",
      ".\test\v3-ui163-express-stop.test.mjs",
      ".\test\v3-ui164-stop-name-marquee.test.mjs",
      ".\frontend\test\domain.test.mjs"
    )
    foreach ($File in $Tests) { if (-not (Test-Path $File)) { throw "Test absent : $File" } }
    node --test @Tests
    if ($LASTEXITCODE -ne 0) { throw "Tests echoues, installation annulee" }
    Write-Host "=== PREPARATION TESTHOST ===" -ForegroundColor Cyan
    node .\scripts\build-attendant-testhost.mjs
    if ($LASTEXITCODE -ne 0) { throw "Preparation echouee" }
    $Gradle = "D:\Android\Gradle\gradle-8.14.3\bin\gradle.bat"
    if (-not (Test-Path $Gradle)) {
       $Found = Get-ChildItem "D:\Android\gradle-home" -Filter gradle.bat -Recurse -File |
         Where-Object { $_.FullName -match 'gradle-8\.14\.3\\bin\\gradle\.bat$' } |
         Select-Object -First 1
       if (-not $Found) { throw "Gradle 8.14.3 introuvable" }
       $Gradle = $Found.FullName
    }
    Write-Host "=== BUILD APK UI-164 ===" -ForegroundColor Cyan
    & $Gradle -p "$Project\android-sync07" :testhost:assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Compilation echouee" }
    $Apk = "$Project\android-sync07\testhost\build\outputs\apk\debug\testhost-debug.apk"
    if (-not (Test-Path $Apk)) { throw "APK absent" }
    $Aapt = Get-ChildItem "$Sdk\build-tools" -Filter aapt.exe -Recurse -File |
      Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    if (-not $Aapt) { throw "AAPT absent" }
    $Badging = & $Aapt dump badging $Apk
    if ($LASTEXITCODE -ne 0) { throw "Lecture manifeste impossible" }
    $Identity = $Badging | Select-String "^package:" | Select-Object -First 1
    if (-not $Identity) { throw "Package APK illisible" }
    if ($Identity.ToString() -match "name='([^']+)'") {
       $ActualPackage = $Matches[1]
    } else { throw "Package APK illisible" }
    if ($ActualPackage -ne $Package) { throw "Application non autorisee : $ActualPackage" }
    $Adb = "$Sdk\platform-tools\adb.exe"
    $Serial = $null
    foreach ($Line in (& $Adb devices)) {
       if ($Line -notmatch '^(emulator-\d+)\s+device\s*$') { continue }
       $Candidate = $Matches[1]
       $Names = @(& $Adb -s $Candidate emu avd name | ForEach-Object { "$_".Trim() })
       if ($Names -contains $ExpectedAvd) { $Serial = $Candidate; break }
    }
    if (-not $Serial) { throw "Emulateur Android 16 absent" }
    $Boot = (& $Adb -s $Serial shell getprop sys.boot_completed | Out-String).Trim()
    $Api = (& $Adb -s $Serial shell getprop ro.build.version.sdk | Out-String).Trim()
    if ($Boot -ne "1" -or $Api -ne "36") { throw "Android 16 non pret" }
    Write-Host "=== INSTALLATION UI-164 SUR $Serial ===" -ForegroundColor Cyan
    & $Adb -s $Serial install --no-streaming -r -t $Apk
    if ($LASTEXITCODE -ne 0) { throw "Installation echouee" }
    $Installed = & $Adb -s $Serial shell pm path $Package
    if ($LASTEXITCODE -ne 0 -or (($Installed | Out-String) -notmatch 'package:')) { throw "APK non installee" }
    & $Adb -s $Serial shell monkey -p $Package -c android.intent.category.LAUNCHER 1
    if ($LASTEXITCODE -ne 0) { throw "Lancement echoue" }
    $Folder = "$Project\Captures-UI164"
    New-Item -ItemType Directory -Force -Path $Folder | Out-Null
    $Image = "$Folder\Accueil-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
    Start-Sleep -Seconds 2 # Let the WebView render before capturing
    & $Adb -s $Serial shell screencap -p /sdcard/qa_ui164.png
    if ($LASTEXITCODE -ne 0) { throw "Capture impossible" }
    & $Adb -s $Serial pull /sdcard/qa_ui164.png $Image
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Image)) { throw "Transfert capture impossible" }
    Write-Host "=== UI-164 : APK TEST INSTALLEE ET LANCEE ===" -ForegroundColor Green
    Write-Host "Emulateur : $ExpectedAvd ($Serial)"
    Write-Host "Capture : $Image"
    Get-FileHash $Apk -Algorithm SHA256
}
