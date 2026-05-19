#!/usr/bin/env bash
# Generate Winget Manifest for Zosma Cowork
#
# Usage: ./scripts/generate-winget-manifest.sh <version>
#   <version> - e.g., 0.10.0 (without v prefix)
#
# This downloads the MSI and EXE from GitHub Releases, computes hashes,
# and generates the winget manifest YAML file.
#
# The generated manifest can be submitted to:
#   https://github.com/microsoft/winget-pkgs

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.10.0"
  exit 1
fi

VERSION="$1"
REPO="zosmaai/zosma-cowork"
OUTPUT_DIR="winget-manifests/z/ZosmaAI/ZosmaCowork/${VERSION}"

mkdir -p "${OUTPUT_DIR}"

echo "Generating winget manifest for Zosma Cowork v${VERSION}"
echo ""

# Download MSI
MSI_URL="https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64_en-US.msi"
echo "Downloading MSI: ${MSI_URL}"
if curl -fSL -o "zosma-cowork.msi" "${MSI_URL}" 2>/dev/null; then
  MSI_SHA256=$(sha256sum zosma-cowork.msi | cut -d' ' -f1)
  echo "  MSI SHA256: ${MSI_SHA256}"
  rm zosma-cowork.msi
else
  echo "  ⚠️  MSI not found at ${MSI_URL}"
  MSI_SHA256=""
fi

# Download EXE
EXE_URL="https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64-setup.exe"
echo "Downloading EXE: ${EXE_URL}"
if curl -fSL -o "zosma-cowork.exe" "${EXE_URL}" 2>/dev/null; then
  EXE_SHA256=$(sha256sum zosma-cowork.exe | cut -d' ' -f1)
  echo "  EXE SHA256: ${EXE_SHA256}"
  rm zosma-cowork.exe
else
  echo "  ⚠️  EXE not found at ${EXE_URL}"
  EXE_SHA256=""
fi

echo ""
echo "Generating multi-file manifest (winget v1.12.0 schema)..."

# File 1: Version manifest
cat > "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml" << YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.version.1.12.0.schema.json

PackageIdentifier: ZosmaAI.ZosmaCowork
PackageVersion: "${VERSION}"
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.12.0
YAML

# File 2: Installer manifest
INSTALLER_FILE="${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.installer.yaml"
cat > "${INSTALLER_FILE}" << YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.installer.1.12.0.schema.json

PackageIdentifier: ZosmaAI.ZosmaCowork
PackageVersion: "${VERSION}"
InstallerLocale: en-US
InstallerType: msi
InstallModes:
  - interactive
  - silent
  - silentWithProgress
UpgradeBehavior: install
ProductCode: "{9229EE7D-C4AE-4F0D-A6BF-E39EA1E2215B}"
Installers:
YAML

if [ -n "${MSI_SHA256}" ]; then
  cat >> "${INSTALLER_FILE}" << YAML
  - Architecture: x64
    InstallerType: msi
    InstallerUrl: https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64_en-US.msi
    InstallerSha256: "${MSI_SHA256}"
YAML
fi

if [ -n "${EXE_SHA256}" ]; then
  cat >> "${INSTALLER_FILE}" << YAML
  - Architecture: x64
    InstallerType: exe
    InstallerUrl: https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64-setup.exe
    InstallerSha256: "${EXE_SHA256}"
    InstallerSwitches:
      Silent: /S
      SilentWithProgress: /S
YAML
fi

cat >> "${INSTALLER_FILE}" << YAML
ManifestType: installer
ManifestVersion: 1.12.0
YAML

# File 3: Locale manifest
cat > "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.locale.en-US.yaml" << YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.defaultLocale.1.12.0.schema.json

PackageIdentifier: ZosmaAI.ZosmaCowork
PackageVersion: "${VERSION}"
PackageLocale: en-US
Publisher: Zosma AI
PublisherUrl: https://zosma.ai
PublisherSupportUrl: https://github.com/${REPO}/issues
PackageName: Zosma Cowork
PackageUrl: https://zosma.ai/zosma-cowork
License: MIT
LicenseUrl: https://github.com/${REPO}/blob/main/LICENSE
ShortDescription: Desktop AI coworker — streaming, thinking, tool calls, multi-turn sessions. India's first Non-Coding Agentic Work Harness.
Moniker: zosma-cowork
Tags:
  - ai
  - agent
  - coworker
  - pi
  - coding
  - assistant
ManifestType: defaultLocale
ManifestVersion: 1.12.0
YAML

echo ""
echo "✅ Manifest generated at: ${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml"
echo ""
echo "To submit to winget-pkgs:"
echo "  1. Fork https://github.com/microsoft/winget-pkgs"
echo "  2. Copy the 'winget-manifests/' directory into your fork as 'manifests/'"
echo "  3. Create a PR"
echo ""
echo "Or use the winget-create CLI:"
echo "  wingetcreate submit ${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml"
