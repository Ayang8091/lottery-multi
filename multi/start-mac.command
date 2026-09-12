#!/bin/bash
cd "$(dirname "$0")"
open http://127.0.0.1:8790 2>/dev/null
node server.js
