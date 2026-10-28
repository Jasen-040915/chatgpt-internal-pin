$ErrorActionPreference = 'Stop'
try {
 $package = Get-AppxPackage OpenAI.Codex | Select-Object -First 1
 if (!$package) { throw 'Supported Store package not found.' }
 $source = Join-Path $package.InstallLocation 'app'
 $destination = Join-Path $env:LOCALAPPDATA 'ChatGPT-Pinned\app'
 $exe = Join-Path $destination 'ChatGPT.exe'
 Write-Host 'Exit ChatGPT completely, including the tray, then press Enter. Keep this installer window open.'
 Read-Host
 if (@(Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe -or $_.Path -eq (Join-Path $source 'ChatGPT.exe') }).Count) { throw 'ChatGPT is still running.' }
 $stage = Join-Path $env:TEMP ('chatgpt-pin-' + [guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $stage | Out-Null
 & python (Join-Path $PSScriptRoot 'patch_client.py') --source (Join-Path $source 'resources\app.asar') --output (Join-Path $stage 'app.asar') --exe-source (Join-Path $source 'ChatGPT.exe') --exe-output (Join-Path $stage 'ChatGPT.exe')
 if ($LASTEXITCODE -ne 0) { throw 'Patch generation failed. The installed version may be unsupported.' }
 New-Item -ItemType Directory -Path $destination -Force | Out-Null
 & robocopy.exe $source $destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS
 if ($LASTEXITCODE -ge 8) { throw 'Copy failed.' }
 Copy-Item -LiteralPath (Join-Path $stage 'app.asar') -Destination (Join-Path $destination 'resources\app.asar') -Force
 Copy-Item -LiteralPath (Join-Path $stage 'ChatGPT.exe') -Destination $exe -Force
 foreach ($pair in @(@((Join-Path $stage 'app.asar'),(Join-Path $destination 'resources\app.asar')),@((Join-Path $stage 'ChatGPT.exe'),$exe))) {
  if ((Get-FileHash -LiteralPath $pair[0]).Hash -ne (Get-FileHash -LiteralPath $pair[1]).Hash) { throw 'Installed file verification failed.' }
 }
 $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ChatGPT.lnk'))
 if ($shortcut.TargetPath -and $shortcut.TargetPath -ne $exe) { throw 'An unrelated ChatGPT desktop shortcut exists; it was not overwritten.' }
 $shortcut.TargetPath = $exe
 $shortcut.WorkingDirectory = $destination
 $shortcut.Save()
 & (Join-Path $PSScriptRoot 'restore-shortcuts.ps1') -AppRoot $destination -PackageRoot $package.InstallLocation
 Write-Host 'Ready. Open ChatGPT from the desktop. If replacing a Store taskbar pin, unpin it once and pin this running window.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
Read-Host 'Press Enter to close'
