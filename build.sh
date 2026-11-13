#!/bin/sh
# Builds the files that are generated from others. Run after changing rules.js,
# site/shorten.js or widget/widget.src.js.
#   widget/Desk Board.js   the Scriptable widget, with shorten.js and rules.js inlined
#   apps-script/Rules.gs   the same rules for the calendar script (evening email, deadline window)
cd "$(dirname "$0")"
sh widget/build.sh
{
  echo '// Generated from rules.js by build.sh. Paste into Apps Script as a file named Rules.'
  sed '/^if (typeof module/,$d' rules.js
} > apps-script/Rules.gs
echo "built widget/Desk Board.js and apps-script/Rules.gs"
