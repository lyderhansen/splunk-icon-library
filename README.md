# Icon Library for Splunk Dashboard Studio

A custom visualization that renders **2,500+ Material Symbols** icons on a Canvas with configurable color, size, background shape, shadow, glow, labels, alignment, rotation, and click drilldown.

The icon font ([Material Symbols Outlined](https://fonts.google.com/icons)) is base64-embedded in `visualization.css` — no external network requests, no CORS issues, Splunk Cloud compatible.

![Screenshot](appserver/static/appIcon.png)

## Installation

1. Download `icon_library-<version>.tar.gz` from the `dist/` folder
2. In Splunk Web: **Apps → Manage Apps → Install app from file**
3. Upload the `.tar.gz` and restart Splunk when prompted

For Splunk Cloud: submit the package through the Cloud vetting process.

## Quick Start

1. Open **Dashboard Studio** and create or edit a dashboard
2. Add a panel and set the visualization type to **Icon Library** (`icon_library.icon_library`)
3. **Set `"backgroundColor": "transparent"` in the panel options** (see note below)
4. Pick an icon from the **Icon (Popular)** dropdown — or type any [Material Symbols](https://fonts.google.com/icons) name in the **Custom Icon Name** field
5. Adjust color, background, glow, shadow, and label in the formatter sidebar

The visualization works **with or without** an attached search.

> **Transparent background:** Dashboard Studio defaults custom visualization panels to a dark/black background. Always add `"backgroundColor": "transparent"` to the panel `options` so the icon blends with the dashboard canvas:
>
> ```json
> "options": {
>     "backgroundColor": "transparent",
>     "icon_library.icon_library.iconName": "security"
> }
> ```

## Finding Icon Names

Browse all icons at **[fonts.google.com/icons](https://fonts.google.com/icons)**

**Syntax rules:**
- Use `lowercase_with_underscores` only
- Examples: `home`, `rocket_launch`, `mode_heat_off`, `nest_thermostat`
- Invalid characters are stripped automatically

## Configuration Options

### Data configurations

| Option | Key | Default | Description |
|---|---|---|---|
| Icon (Popular) | `iconName` | `home` | Select from 150+ popular icons |
| Custom Icon Name | `customIcon` | _(empty)_ | Any Material Symbols name — overrides dropdown |

### Data display

| Option | Key | Default | Description |
|---|---|---|---|
| Icon Size | `iconSize` | `0` (auto) | Fixed pixel size, or `0` to auto-scale to panel |
| Horizontal Align | `hAlign` | `center` | `left`, `center`, `right` |
| Vertical Align | `vAlign` | `center` | `top`, `center`, `bottom` |
| Rotation | `rotation` | `0` | Degrees (0–360) |
| Show Label | `showLabel` | `no` | `yes` / `no` |
| Label Text | `labelText` | _(empty)_ | Text below the icon |
| Label Size | `labelSize` | `0` (auto) | Fixed pixel size, or `0` to auto-scale |
| Label Color | `labelColor` | `#94A3B8` | Hex color |
| Enable Drilldown | `drilldown` | `no` | `yes` / `no` — enables click events |
| Drilldown URL | `drilldownUrl` | _(empty)_ | URL with `$icon$`, `$label$`, `$color$` tokens |
| Drilldown New Tab | `drilldownNewTab` | `yes` | `yes` / `no` |

### Color and style

| Option | Key | Default | Description |
|---|---|---|---|
| Icon Color | `iconColor` | `#06B6D4` | Hex color of the icon |
| Background Shape | `bgShape` | `none` | `none`, `circle`, `rounded_rect`, `square` |
| Background Color | `bgColor` | `#1E293B` | Hex fill color |
| Background Opacity | `bgOpacity` | `1` | 0 (transparent) to 1 (opaque) |
| Background Padding | `bgPadding` | `16` | Space between icon and shape edge (px) |
| Corner Radius | `bgRadius` | `12` | For `rounded_rect` only (px) |
| Shadow | `shadow` | `no` | `yes` / `no` |
| Shadow Color | `shadowColor` | `#000000` | Hex color |
| Shadow Blur | `shadowBlur` | `8` | Blur radius (px) |
| Shadow Offset X | `shadowOffsetX` | `0` | Horizontal offset (px) |
| Shadow Offset Y | `shadowOffsetY` | `4` | Vertical offset (px) |
| Glow | `glow` | `no` | `yes` / `no` |
| Glow Color | `glowColor` | `#06B6D4` | Hex color |
| Glow Size | `glowSize` | `12` | Glow radius (px) |

## Data-Driven Icons

Attach a search that returns columns named `icon`, `color`, `label`, or `value`:

```spl
| stats count AS value BY src_ip
| eval icon=if(value>100, "warning", "check_circle"),
       color=if(value>100, "#EF4444", "#22C55E"),
       label=src_ip
| head 1
```

| SPL Column | Effect |
|---|---|
| `icon` | Overrides the icon name (sanitized to `lowercase_underscores`) |
| `color` | Overrides icon color (hex) |
| `label` | Sets label text and auto-enables label display |
| `value` | Threshold coloring: ≥90 green, ≥50 amber, <50 red |

## Drilldown / Click Interactions

### Option A: Dashboard Studio eventHandlers (recommended)

Set **Enable Drilldown = Yes** and leave **Drilldown URL** empty. Add `eventHandlers` in the JSON:

```json
"viz_my_icon": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_search" },
  "options": {
    "icon_library.icon_library.customIcon": "security",
    "icon_library.icon_library.drilldown": "yes"
  },
  "eventHandlers": [{
    "type": "drilldown.setToken",
    "options": {
      "tokens": [{
        "token": "selected_icon",
        "value": "$row.icon.value$"
      }]
    }
  }]
}
```

### Option B: Direct URL navigation

Set **Drilldown URL** to any URL with token placeholders:

```
https://mysplunk.com/app/search/search?q=index%3Dmain%20icon%3D$icon$
```

Available tokens: `$icon$`, `$label$`, `$color$` (URL-encoded).

## Dashboard Studio JSON Example

All custom option keys use the prefix `icon_library.icon_library.` in Dashboard Studio JSON. Always include the bare `"backgroundColor": "transparent"` to avoid the default dark panel background:

```json
"viz_status_icon": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_health" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "monitor_heart",
    "icon_library.icon_library.iconColor": "#22C55E",
    "icon_library.icon_library.iconSize": "0",
    "icon_library.icon_library.showLabel": "yes",
    "icon_library.icon_library.labelText": "Healthy",
    "icon_library.icon_library.labelColor": "#94A3B8",
    "icon_library.icon_library.bgShape": "circle",
    "icon_library.icon_library.bgColor": "#0F172A",
    "icon_library.icon_library.bgPadding": "20",
    "icon_library.icon_library.glow": "yes",
    "icon_library.icon_library.glowColor": "#22C55E",
    "icon_library.icon_library.glowSize": "12",
    "icon_library.icon_library.shadow": "yes",
    "icon_library.icon_library.shadowBlur": "8",
    "icon_library.icon_library.shadowOffsetY": "4",
    "icon_library.icon_library.drilldown": "yes"
  }
}
```

## Included Dashboards

| Dashboard | Description |
|---|---|
| **README** | Interactive documentation with live examples |
| **Icon Showcase** | 256 icons across 17 themed sections demonstrating all settings |

## File Structure

```
icon_library/
├── appserver/static/visualizations/icon_library/
│   ├── src/visualization_source.js    # Source (Canvas 2D rendering)
│   ├── visualization.js               # Webpack bundle
│   ├── visualization.css              # Base64-embedded Material Symbols font
│   ├── formatter.html                 # Dashboard Studio config UI
│   ├── fonts/                         # Source font + embed script + font NOTICE
│   └── webpack.config.js
├── default/
│   ├── app.conf
│   ├── visualizations.conf
│   └── data/ui/
│       ├── nav/default.xml
│       └── views/
│           ├── readme.xml             # README dashboard
│           └── showcase.xml           # 256-icon showcase
├── metadata/default.meta
├── LICENSE                            # Apache 2.0 license for this app
├── NOTICE                             # Third-party attributions
└── README.md
```

## Version History

| Version | Changes |
|---|---|
| 1.3.3 | Add LICENSE + NOTICE; relicense to Apache 2.0 with proper Material Symbols attribution |
| 1.3.1 | Code cleanup, remove unused import, transparent background docs |
| 1.3.0 | README dashboard, AppInspect fixes, icon name corrections |
| 1.2.0 | Drilldown support, 256-icon showcase dashboard |
| 1.1.0 | Alignment controls, label-inside-background, icon name sanitization |
| 1.0.0 | Initial release with 2,500+ Material Symbols icons |

## License

This project is released under the **Apache License, Version 2.0** — see
[LICENSE](LICENSE) for the full license text and [NOTICE](NOTICE) for
third-party attributions.

Apache 2.0 permits free use, modification, and redistribution (including
commercial use) provided the license text and attribution notices are
preserved.

### Third-party assets

The **Material Symbols Outlined** font is bundled verbatim (base64-embedded in
`visualization.css`) and is itself licensed under the Apache License, Version
2.0:

- **Source**: [github.com/google/material-design-icons](https://github.com/google/material-design-icons)
- **Copyright**: Google LLC
- **Attribution summary**: [NOTICE](NOTICE)

No modifications have been made to the font binary itself.
