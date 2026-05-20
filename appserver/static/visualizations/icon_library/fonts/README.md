# Material Symbols Outlined

`material_symbols_outlined.woff2` is the Google Material Symbols Outlined
variable font, bundled verbatim and base64-embedded into
`../visualization.css` so it loads with no external network requests
(required for Splunk Cloud compatibility).

- **Source**: https://github.com/google/material-design-icons
- **License**: Apache License, Version 2.0 (see the LICENSE file at the app root)
- **Copyright**: Google LLC

No modifications have been made to the font binary itself.

To refresh the font from upstream and rebuild the base64 block in
`visualization.css`, run `./embed-font.sh`.
