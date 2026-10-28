# ChatGPT Internal Pin

Adds a pin button to the title bar of the Windows ChatGPT main window. Click to keep the window on top; click again to unpin. The preference is saved. The application and shortcuts keep the name **ChatGPT** and use the original Store icon from the local installation.

This repository contains original patch code and tooling only. It does not include OpenAI application binaries, icons, or account data. Unofficial project, not affiliated with OpenAI. The MIT license applies to the original code in this repository.

## Supported build

Internal version `26.1023.50603`, observed in Store package `OpenAI.Codex_26.1023.6123.0_x64`. The patch checks the original main-process and preload SHA-256 hashes. Other builds are rejected and require adaptation.

## Install

Requires Python 3.11+ and Windows PowerShell. Download the source and run this command in a separate PowerShell window:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-local.ps1
```

When prompted, completely exit ChatGPT, including its tray process. Keep the installer window open and press Enter. Do not run the installer inside the client that you are about to close.

The installer copies the complete locally installed client to `%LOCALAPPDATA%\ChatGPT-Pinned\app`, patches the copied ASAR and executable, and verifies the installed files. The desktop shortcut is named **ChatGPT**. It does not automatically launch the client.

An existing Store taskbar pin remains bound to the Store application. Unpin it once, open the modified client from the desktop, and pin its running icon. Thereafter, use that taskbar icon. Repair the name and original icon of existing shortcuts pointing to the modified client with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\restore-shortcuts.ps1
```

## Implementation and troubleshooting workflow

1. Identify the installed package and internal version, back up the original files, parse the ASAR index, and verify source hashes.
2. Attach `pin-main.cjs` only when the primary window is created. Use Electron `setAlwaysOnTop`, read its actual state, and persist the preference.
3. Add an icon-only button through the isolated preload and a closed Shadow DOM. IPC accepts only registered windows and their local top-level document; foreign windows, subframes, and remote documents are rejected.
4. Create a new ASAR, retain original packed data, append changed entries, update integrity metadata, and read the entries back for verification.
5. Synchronize the executable's embedded ASAR-header SHA-256 only when the original hash occurs exactly once. ASAR integrity checks and the `onlyLoadAppFromAsar` fuse remain enabled. Modifying the executable invalidates its original Authenticode signature.
6. Direct replacement inside WindowsApps was denied on the development machine. The original installed files and permissions were restored. Delivery therefore uses a complete client copy in a normal user directory.
7. Closing the client interrupted installation launched by that client. Installation now runs from an independent user-opened window.
8. The default executable icon differed from the Store icon. The repair script reads the original local Store PNG, wraps the unchanged image in ICO format, and updates shortcut icon references. The name remains **ChatGPT**.

## Validation

```powershell
node --test test_pin.cjs
python patch_client.py --source ORIGINAL_ASAR --output NEW_ASAR --exe-source ORIGINAL_EXE --exe-output NEW_EXE
```

Three main-process tests pass: native toggling and persistence, rejection of unauthorized sources, and preserving a pin through host focus resets while allowing explicit unpinning. Generated ASAR entries were read back successfully. Executable integrity synchronization was checked against the staged patched executable.

An earlier local client copy was clicked live and changed its button label to the unpin action. The user subsequently ran the current installer, and a process from the modified installation was observed. Desktop and taskbar shortcut names and icon references were verified; the ICO image payload exactly matches the original Store asset.

Complete current-build acceptance testing across application switching, restart persistence, and display scales remains outstanding. Explorer may refresh its cached icon when the client is next opened. The general installer has passed syntax checks but has not been run end to end on a second machine. Generated ASAR and EXE files contain local application code and must remain local.

## Restore and update

Exit the modified client and unpin it. Open the original Store client from the Start menu and pin it again. Store updates do not automatically update the copied client. New builds require fresh verification and patch adaptation.
