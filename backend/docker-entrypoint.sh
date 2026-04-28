#!/bin/sh
set -e

mkdir -p /app/shared/clips
chown -R appuser:appuser /app/shared/clips

exec gosu appuser "$@"
