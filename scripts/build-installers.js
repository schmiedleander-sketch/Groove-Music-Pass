const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Starting Groove Music Pass Windows Build ===');

// Step 1: Run electron-builder to generate unpacked Windows app directory
console.log('Building unpacked x64 Windows application via electron-builder...');
execSync('npx electron-builder --win --dir --x64', { stdio: 'inherit' });

const unpackedDir = path.resolve(__dirname, '../dist/win-unpacked');
if (!fs.existsSync(unpackedDir)) {
  console.error('Error: win-unpacked directory not found!');
  process.exit(1);
}
console.log(`Unpacked build successful at: ${unpackedDir}`);

// Step 2: Build NSIS EXE Installer using makensis
console.log('Building NSIS EXE Installer...');
const makensisExecutable = '/home/jules/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/linux/makensis';
const nsisDir = '/home/jules/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n';
const nsiScriptPath = path.resolve(__dirname, 'installer.nsi');
const exeOutputPath = path.resolve(__dirname, '../dist/GrooveMusicPass_Setup_1.0.0.exe');

const nsiScriptContent = `
!addincludedir "${nsisDir}/Include"

!define PRODUCT_NAME "Groove Music Pass"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Microsoft Corporation"
!define PRODUCT_WEB_SITE "https://www.microsoft.com"
!define PRODUCT_DIR_REGKEY "Software\\Microsoft\\GrooveMusicPass"
!define PRODUCT_UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Groove Music Pass"

SetCompressor /SOLID lzma
Name "Groove Music Pass 1.0.0"
OutFile "${exeOutputPath}"
InstallDir "$PROGRAMFILES64\\Groove Music Pass"
Icon "${path.resolve(__dirname, '../build/icon.ico')}"
UninstallIcon "${path.resolve(__dirname, '../build/icon.ico')}"
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  File /r "${unpackedDir}\\*"

  CreateDirectory "$SMPROGRAMS\\Groove Music Pass"
  CreateShortcut "$SMPROGRAMS\\Groove Music Pass\\Groove Music Pass.lnk" "$INSTDIR\\Groove Music Pass.exe" "" "${path.resolve(__dirname, '../build/icon.ico')}"
  CreateShortcut "$DESKTOP\\Groove Music Pass.lnk" "$INSTDIR\\Groove Music Pass.exe" "" "${path.resolve(__dirname, '../build/icon.ico')}"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\\uninst.exe"
  WriteRegStr HKLM "\${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\\Groove Music Pass.exe"
  WriteRegStr HKLM "\${PRODUCT_UNINST_KEY}" "DisplayName" "Groove Music Pass"
  WriteRegStr HKLM "\${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\\uninst.exe"
  WriteRegStr HKLM "\${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\\Groove Music Pass.exe"
  WriteRegStr HKLM "\${PRODUCT_UNINST_KEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "\${PRODUCT_UNINST_KEY}" "Publisher" "Microsoft Corporation"
SectionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_OK|MB_ICONINFORMATION "Groove Music Pass was successfully removed from your computer."
FunctionEnd

Section Uninstall
  Delete "$DESKTOP\\Groove Music Pass.lnk"
  Delete "$SMPROGRAMS\\Groove Music Pass\\Groove Music Pass.lnk"
  RMDir "$SMPROGRAMS\\Groove Music Pass"

  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "\${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "\${PRODUCT_DIR_REGKEY}"
SectionEnd
`;

fs.writeFileSync(nsiScriptPath, nsiScriptContent, 'utf-8');
execSync(`${makensisExecutable} -NOCONFIG "${nsiScriptPath}"`, {
  stdio: 'inherit',
  env: { ...process.env, NSISDIR: nsisDir }
});
console.log(`EXE Installer created successfully at: ${exeOutputPath}`);

// Step 3: Build WiX MSI Installer using wixl
console.log('Building WiX MSI Installer...');
const msiOutputPath = path.resolve(__dirname, '../dist/GrooveMusicPass_Installer_1.0.0.msi');
const wxsScriptPath = path.resolve(__dirname, 'installer.wxs');

function collectWxsFiles(dirPath, relativeDir = '') {
  const entries = fs.readdirSync(dirPath);
  let filesXml = '';
  let dirsXml = '';
  let refs = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry);
    const relPath = relativeDir ? `${relativeDir}\\${entry}` : entry;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subResult = collectWxsFiles(fullPath, relPath);
      const safeDirId = 'Dir_' + Math.random().toString(36).substring(2, 9);
      dirsXml += `<Directory Id="${safeDirId}" Name="${entry}">\n${subResult.filesXml}\n${subResult.dirsXml}\n</Directory>\n`;
      refs = refs.concat(subResult.refs);
    } else {
      const safeFileId = 'File_' + Math.random().toString(36).substring(2, 9);
      const safeCompId = 'Comp_' + Math.random().toString(36).substring(2, 9);
      refs.push(safeCompId);

      let extraShortcut = '';
      if (entry === 'Groove Music Pass.exe') {
        extraShortcut = `
          <Shortcut Id="StartMenuShortcut" Name="Groove Music Pass" Directory="ProgramMenuFolder" WorkingDirectory="INSTALLDIR" Icon="AppIcon.ico" Advertise="yes" />
          <Shortcut Id="DesktopShortcut" Name="Groove Music Pass" Directory="DesktopFolder" WorkingDirectory="INSTALLDIR" Icon="AppIcon.ico" Advertise="yes" />
        `;
      }

      filesXml += `
        <Component Id="${safeCompId}" Guid="*">
          <File Id="${safeFileId}" Source="${fullPath}" KeyPath="yes">
            ${extraShortcut}
          </File>
        </Component>
      `;
    }
  });

  return { filesXml, dirsXml, refs };
}

const wxsData = collectWxsFiles(unpackedDir);

const wxsContent = `<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="Groove Music Pass" UpgradeCode="de5cc7db-9241-569d-88b2-ee2cde431862" Language="1033" Codepage="1252" Version="1.0.0" Manufacturer="Microsoft Corporation">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" Comments="Groove Music Pass Windows Installer" />
    <Media Id="1" Cabinet="groove.cab" EmbedCab="yes" />

    <Icon Id="AppIcon.ico" SourceFile="${path.resolve(__dirname, '../build/icon.ico')}" />
    <Property Id="ARPPRODUCTICON" Value="AppIcon.ico" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="Groove Music Pass">
          ${wxsData.filesXml}
          ${wxsData.dirsXml}
        </Directory>
      </Directory>
      <Directory Id="ProgramMenuFolder" />
      <Directory Id="DesktopFolder" />
    </Directory>

    <Feature Id="MainFeature" Level="1">
      ${wxsData.refs.map(r => `<ComponentRef Id="${r}" />`).join('\n')}
    </Feature>
  </Product>
</Wix>`;

fs.writeFileSync(wxsScriptPath, wxsContent, 'utf-8');
execSync(`wixl -o "${msiOutputPath}" "${wxsScriptPath}"`, { stdio: 'inherit' });
console.log(`MSI Installer created successfully at: ${msiOutputPath}`);

console.log('=== Build Complete ===');
console.log(`EXE: ${exeOutputPath}`);
console.log(`MSI: ${msiOutputPath}`);
