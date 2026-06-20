# Open the running Expo dev server in Expo Go on the Android emulator.
# Use when `npx expo start` + pressing `a` fails with host.exp.exponent / LAUNCHER errors.
param(
  [int]$Port = 8082
)

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  throw "adb not found. Install Android SDK platform-tools or add adb to PATH."
}

$devices = & $adb devices | Select-String "device$"
if (-not $devices) {
  throw "No Android emulator/device connected. Start Pixel_7_API_36 (or any AVD) first."
}

# Metro + backend on host → reachable from emulator
& $adb reverse tcp:$Port tcp:$Port | Out-Null
& $adb reverse tcp:5000 tcp:5000 | Out-Null

# Match the port shown in `npx expo start` (e.g. 8085 if 8081–8084 are busy)
$expUrl = "exp://10.0.2.2:$Port"
Write-Host "Opening $expUrl in Expo Go (Metro must be running on port $Port)..."
& $adb shell am start -a android.intent.action.VIEW -d $expUrl
