#!/usr/bin/env bash
set -euo pipefail

#
# build.sh — Package this Splunk app as an installable .tar.gz
#
# Usage:
#   ./build.sh                # Build + package
#   ./build.sh --no-webpack   # Skip the webpack rebuild (use existing visualization.js)
#
# Output:
#   dist/icon_library-{version}.tar.gz
#
# If you don't have node/npm and visualization.js already exists,
# run with --no-webpack to skip the rebuild step.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="icon_library"
VIZ_DIR="$SCRIPT_DIR/appserver/static/visualizations/$APP_NAME"
OUTPUT_DIR="$SCRIPT_DIR/dist"

SKIP_WEBPACK=0
for arg in "$@"; do
    case "$arg" in
        --no-webpack) SKIP_WEBPACK=1 ;;
    esac
done

if [ ! -f "$SCRIPT_DIR/default/app.conf" ]; then
    echo "Error: default/app.conf not found. Run from the repo root."
    exit 1
fi

VERSION=$(grep '^version' "$SCRIPT_DIR/default/app.conf" | head -1 | cut -d= -f2 | tr -d ' ')
TARBALL="$OUTPUT_DIR/${APP_NAME}-${VERSION}.tar.gz"

mkdir -p "$OUTPUT_DIR"

echo "=== Building: $APP_NAME v$VERSION ==="

# Step 1: rebuild the webpack bundle (optional)
if [ "$SKIP_WEBPACK" -eq 0 ]; then
    if [ -f "$VIZ_DIR/package.json" ]; then
        if [ ! -d "$VIZ_DIR/node_modules" ]; then
            echo "Installing npm dependencies..."
            (cd "$VIZ_DIR" && npm install --silent)
        fi
        echo "Building webpack bundle..."
        (cd "$VIZ_DIR" && npm run build --silent)
    fi
else
    echo "Skipping webpack rebuild (using existing visualization.js)"
fi

if [ ! -f "$VIZ_DIR/visualization.js" ]; then
    echo "Error: $VIZ_DIR/visualization.js is missing. Cannot package."
    exit 1
fi

# Step 2: stage files into a temp dir under the Splunk app name
STAGING=$(mktemp -d)
trap "rm -rf $STAGING" EXIT
APP_STAGING="$STAGING/$APP_NAME"
mkdir -p "$APP_STAGING"

rsync -a \
    --exclude='node_modules/' \
    --exclude='dist/' \
    --exclude='.git/' \
    --exclude='.gitignore' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='__MACOSX/' \
    --exclude='build.sh' \
    --exclude='appserver/static/visualizations/*/src/' \
    --exclude='appserver/static/visualizations/*/package.json' \
    --exclude='appserver/static/visualizations/*/package-lock.json' \
    --exclude='appserver/static/visualizations/*/webpack.config.js' \
    --exclude='appserver/static/visualizations/*/harness.json' \
    --exclude='appserver/static/visualizations/*/fonts/' \
    --exclude='_generate_showcase.py' \
    --exclude='docs/' \
    --exclude='CLAUDE.md' \
    "$SCRIPT_DIR/" \
    "$APP_STAGING/"

# Step 3: package
echo "Packaging $TARBALL..."

TAR_FLAGS=()
if [[ "$(uname)" == "Darwin" ]]; then
    xattr -rc "$APP_STAGING" 2>/dev/null || true
    export COPYFILE_DISABLE=1
    TAR_FLAGS+=(--disable-copyfile --no-xattrs --no-mac-metadata)
fi

tar "${TAR_FLAGS[@]}" \
    --exclude='.*' \
    --exclude='._*' \
    --exclude='__MACOSX' \
    -czf "$TARBALL" \
    -C "$STAGING" \
    "$APP_NAME"

echo ""
echo "Done."
echo "Tarball: $TARBALL"
echo ""
echo "Install with:"
echo "  \$SPLUNK_HOME/bin/splunk install app $TARBALL"
