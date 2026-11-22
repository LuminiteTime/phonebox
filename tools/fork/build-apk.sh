#!/usr/bin/env bash
# Builds the fork's release APK signed with a stable local key, so updates install over each other.
# The key and its passwords live outside the repo in $SIGNING_DIR (created on the first run; back it up:
# losing it means uninstalling the app on the tablet once more).
set -euo pipefail

SIGNING_DIR="${PHONEBOX_SIGNING_DIR:-$HOME/.config/phonebox-fork}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export JAVA_HOME="${JAVA_HOME_17:-$(/usr/libexec/java_home -v 17)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/dev/tools/android-sdk}"

if [[ ! -f "$SIGNING_DIR/signing.env" ]]; then
  mkdir -p "$SIGNING_DIR" && chmod 700 "$SIGNING_DIR"
  pass="$(openssl rand -hex 24)"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$SIGNING_DIR/release.jks" -alias phonebox-fork \
    -keyalg RSA -keysize 4096 -validity 36500 -storepass "$pass" -keypass "$pass" -dname "CN=PhoneBox fork" >/dev/null
  printf 'PHONEBOX_STORE_FILE=%s\nPHONEBOX_KEY_ALIAS=phonebox-fork\nPHONEBOX_STORE_PASSWORD=%s\nPHONEBOX_KEY_PASSWORD=%s\n' \
    "$SIGNING_DIR/release.jks" "$pass" "$pass" > "$SIGNING_DIR/signing.env"
  chmod 600 "$SIGNING_DIR/signing.env"
fi
set -a; source "$SIGNING_DIR/signing.env"; set +a

cd "$ROOT/android"
./gradlew --quiet assembleRelease
ls -1 "$ROOT"/android/app/build/outputs/apk/release/*.apk
