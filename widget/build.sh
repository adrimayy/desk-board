#!/bin/sh
# Builds the single-file Scriptable script: shorten.js inlined, then the widget.
cd "$(dirname "$0")"
{
  echo '// Variables used by Scriptable.'
  echo '// These must be at the very top of the file. Do not edit.'
  echo '// icon-color: deep-green; icon-glyph: calendar-alt;'
  echo 'const Shorten = (function () { var module = { exports: {} };'
  cat ../shorten.js
  echo 'return module.exports; })();'
  echo
  echo '/* ---------- Calendar rules (site/rules.js) ---------- */'
  sed '/^if (typeof module/,$d' ../rules.js
  echo
  cat widget.src.js
} > "Desk Board.js"
