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
echo "Generating manifest..."

# Write the manifest file
cat > "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml" << YAML
PackageIdentifier: ZosmaAI.ZosmaCowork
PackageVersion: "${VERSION}"
PackageLocale: en-US
Publisher: Zosma AI
PublisherUrl: https://zosma.ai
PublisherSupportUrl: https://github.com/zosmaai/zosma-cowork/issues
PackageName: Zosma Cowork
PackageUrl: https://zosma.ai/zosma-cowork
License: MIT
LicenseUrl: https://github.com/zosmaai/zosma-cowork/blob/main/LICENSE
ShortDescription: Desktop AI coworker — streaming, thinking, tool calls, multi-turn sessions. India's first Non-Coding Agentic Work Harness.
Moniker: zosma-cowork
Tags:
  - ai
  - agent
  - coworker
  - pi
  - coding
  - assistant
Installers:
YAML

if [ -n "${MSI_SHA256}" ]; then
  cat >> "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml" << YAML
  - Architecture: x64
    InstallerType: msi
    InstallerUrl: https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64_en-US.msi
    InstallerSha256: "${MSI_SHA256}"
YAML
fi

if [ -n "${EXE_SHA256}" ]; then
  cat >> "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml" << YAML
  - Architecture: x64
    InstallerType: exe
    InstallerUrl: https://github.com/${REPO}/releases/download/v${VERSION}/zosma-cowork_${VERSION}_x64-setup.exe
    InstallerSha256: "${EXE_SHA256}"
    InstallerSwitches:
      Silent: /S
      SilentWithProgress: /S
YAML
fi

cat >> "${OUTPUT_DIR}/ZosmaAI.ZosmaCowork.yaml" << YAML
ManifestVersion: 1.9.0
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
