#!/bin/sh
set -e

APP_UID=${APP_UID:-113}
APP_GID=${APP_GID:-113}

getent group "$APP_GID" >/dev/null 2>&1 || addgroup -g "$APP_GID" -S dkim
getent passwd "$APP_UID" >/dev/null 2>&1 || \
    adduser -u "$APP_UID" -S -G "$(getent group "$APP_GID" | cut -d: -f1)" dkim

exec su-exec "$APP_UID:$APP_GID" "$@"
