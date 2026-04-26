#!/bin/bash
git config core.hooksPath .githooks
echo "✅ Git hooks configured to use .githooks/"
chmod +x .githooks/* 2>/dev/null || true
