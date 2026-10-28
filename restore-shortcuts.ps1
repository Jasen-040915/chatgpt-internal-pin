param([string]$AppRoot = (Join-Path $env:LOCALAPPDATA 'ChatGPT-Pinned\app'), [string]$PackageRoot)
$ErrorActionPreference = 'Stop'
if (!$PackageRoot) { $PackageRoot = (Get-AppxPackage OpenAI.Codex | Select-Object -First 1).InstallLocation }
if (!$PackageRoot) { throw 'Cannot locate the original installed package.' }
$png = Join-Path $PackageRoot 'assets\Square44x44Logo.targetsize-256_altform-unplated.png'
$data = [IO.File]::ReadAllBytes($png)
$icon = Join-Path $AppRoot 'resources\original-store-icon.ico'
$stream = [IO.File]::Create($icon)
$writer = New-Object IO.BinaryWriter($stream)
try {
 $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
 $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
 $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$data.Length); $writer.Write([uint32]22); $writer.Write($data)
} finally { $writer.Dispose() }
$shell = New-Object -ComObject WScript.Shell
$dirs = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'))
foreach ($dir in $dirs) {
 foreach ($file in @(Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -ErrorAction SilentlyContinue)) {
  $link = $shell.CreateShortcut($file.FullName)
  if ($link.TargetPath -ne (Join-Path $AppRoot 'ChatGPT.exe')) { continue }
  $link.IconLocation = "$icon,0"
  $link.Description = 'ChatGPT'
  $link.Save()
  if ($file.BaseName -ne 'ChatGPT') {
   $renamed = Join-Path $dir 'ChatGPT.lnk'
   if (Test-Path -LiteralPath $renamed) { throw "Shortcut already exists: $renamed" }
   Move-Item -LiteralPath $file.FullName -Destination $renamed
  }
 }
}
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class PinShellRefresh { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b); }'
[PinShellRefresh]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)
Write-Host 'ChatGPT shortcut name and original Store icon restored.'
