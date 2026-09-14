#!/bin/bash
set -euo pipefail
# Developer ID signing requires the owner's certificate in Keychain and an App Store Connect notary profile.
# Usage: scripts/notarize-macos.sh /path/LocalNeuron.app 'Developer ID Application: Owner (TEAM)' notary-profile
app_path=${1:?Informe o caminho do app}
identity=${2:?Informe a identidade Developer ID Application}
profile=${3:?Informe o perfil do notarytool no Chaves}
[[ "$identity" == 'Developer ID Application:'* ]] || { echo 'Use um certificado Developer ID Application válido.' >&2; exit 1; }
[[ -d "$app_path/Contents" ]] || { echo 'Bundle inválido.' >&2; exit 1; }
# Sign each nested Mach-O inside out; never replace the owner's test app with this public artifact.
while IFS= read -r -d '' item; do
  if /usr/bin/file -b "$item" | /usr/bin/grep -q 'Mach-O'; then
    /usr/bin/codesign --force --options runtime --timestamp --entitlements scripts/macos-entitlements.plist --sign "$identity" "$item"
  fi
done < <(/usr/bin/find "$app_path/Contents" -type f -print0)
while IFS= read -r item; do
  /usr/bin/codesign --force --options runtime --timestamp --entitlements scripts/macos-entitlements.plist --sign "$identity" "$item"
done < <(/usr/bin/find "$app_path/Contents" -depth -type d \( -name '*.app' -o -name '*.framework' \))
/usr/bin/codesign --force --options runtime --timestamp --entitlements scripts/macos-entitlements.plist --sign "$identity" "$app_path"
/usr/bin/codesign --verify --deep --strict "$app_path"
archive_path=$(mktemp -u /tmp/localneuron-notary.XXXXXX.zip)
trap 'rm -f "$archive_path"' EXIT
/usr/bin/ditto -c -k --keepParent "$app_path" "$archive_path"
xcrun notarytool submit "$archive_path" --keychain-profile "$profile" --wait
xcrun stapler staple "$app_path"
xcrun stapler validate "$app_path"
/usr/sbin/spctl --assess --type execute --verbose "$app_path"
