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
| Drilldown URL | `drilldownUrl` | _(empty)_ | Optional URL with `$icon$`, `$label$`, `$color$` tokens. Leaving empty falls through to Dashboard Studio eventHandlers when the panel has `"drilldown": "all"`. |
| Drilldown New Tab | `drilldownNewTab` | `yes` | `yes` / `no` — only applies when `drilldownUrl` is set |

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
| `color` | Overrides icon color (hex). Wins over the threshold engine. |
| `label` | Sets label text and auto-enables label display |
| `value` | Drives the threshold engine (see below) — band picked from formatter settings |

## Threshold Colors

The formatter's **Threshold colors** section drives icon/label/glow/background color from a numeric SPL column.

| Setting | Default | Description |
|---|---|---|
| Source field | `value` | SPL column name whose numeric value picks the band |
| Low threshold | `50` | Values strictly below this fall in the low band |
| High threshold | `90` | Values at or above this fall in the high band; in-between → mid band |
| Direction | `High = good` | Flips the band order (use `High = bad` for errors, latency) |
| Low / Mid / High band color | `#EF4444` / `#F59E0B` / `#22C55E` | Three color pickers |
| Apply to icon / label / glow / background | icon=Yes, others=No | Per-element opt-in |

## Threshold Effects (per band)

The **Threshold effects** formatter section drives non-color visual changes per band — icon swap, glow scaling, and pulse animation.

| Setting | Default | Description |
|---|---|---|
| Icon (low / mid / high band) | _(empty)_ | Override the icon name when in that band. Empty = use the formatter icon. Example: `error` / `warning` / `check_circle`. |
| Glow scale (low / mid / high band) | `1` / `1` / `1` | Multiplier applied to `glowSize` for that band. `2` doubles glow, `0` removes it. |
| Pulse animation | `Off` | `Off`, `Critical band only`, `Warning (mid) band only`, or `Critical + warning`. **Critical band** = low band when `High=good`, high band when `High=bad`. Requires Glow enabled. |
| Pulse speed | `1` | Pulses per second. `2` = faster, `0.5` = slower. |

The pulse animation modulates the glow radius by ±45% around its base size via a `requestAnimationFrame` loop. The loop cancels itself when the band changes (or on viz destroy) — no leaked animation frames.

### Beyond 3 bands

The native formatter exposes 3 bands. For more (5-band heatmaps, 10-band gradients, exact-string matching), use Dashboard Studio DOS on `iconColor` / `labelColor` / `glowColor` / `bgColor` with `rangeValue`, `gradient`, or `matchValue` — the same mechanism Splunk's built-in single-value uses behind its gradient widget. The DOS path supports arbitrary band counts; see the JSON example below.

### Two ways to drive search-based color

**A) Formatter thresholds (no JSON required).** Enable the per-element toggles and configure the thresholds. Defaults reproduce the classic RAG scheme (red <50, amber 50–89, green ≥90).

**B) Splunk DOS in dashboard JSON (power users).** Any of `iconColor`, `labelColor`, `glowColor`, `bgColor` accept the full Dashboard Studio Dynamic Options Syntax:

```json
"viz_status": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_health" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "monitor_heart",
    "icon_library.icon_library.iconColor":
      "> primary | seriesByName('uptime_pct') | lastPoint() | rangeValue(colors)",
    "icon_library.icon_library.colorIcon": "no"
  },
  "context": {
    "colors": [
      { "to": 95,             "value": "#EF4444" },
      { "from": 95, "to": 99, "value": "#F59E0B" },
      { "from": 99,           "value": "#22C55E" }
    ]
  }
}
```

When you drive a color via DOS, set the matching **Apply to … color** toggle to **No** so the formatter thresholds don't override your DOS-resolved value.

## Drilldown / Click Interactions

### Option A: Dashboard Studio eventHandlers (recommended)

Drilldown is automatic — no per-viz toggle. Two things must line up for setToken to fire:

1. The panel must declare `"drilldown": "all"` in its `options` — without this, Dashboard Studio swallows the click silently
2. An `eventHandlers` array with a `drilldown.setToken` entry. The `key` field references a literal field name in the payload — the viz emits `{icon: "<resolved icon name>", label: "<label>"?, color: "<hex>"?}`. **Use `"key": "icon"`** to capture the icon name. The `click.value` syntax from native chart vizs and the `row.<field>.value` syntax from table vizs both do not work for our payload shape.

```json
"viz_my_icon": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_search" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "security",
    "drilldown": "all"
  },
  "eventHandlers": [{
    "type": "drilldown.setToken",
    "options": {
      "tokens": [
        { "token": "selected_icon", "key": "icon" }
      ]
    }
  }]
}
```

What gets populated:

| Studio token | Value |
|---|---|
| `icon` (in payload) | The resolved icon name (or the value of the `icon` SPL column if data-driven). Reference with `"key": "icon"`. |
| `label` (in payload) | The label text — only present when a label is rendered. Reference with `"key": "label"`. |
| `color` (in payload) | The resolved icon color (hex). Reference with `"key": "color"`. |
| `click.name` | `"icon"` |

The visualization renders a single click target per panel, so the payload `value` field is always the icon name. To capture label/color too, use Option B with a multi-token URL, or wire a separate `setToken` handler from your data source.

### Option B: Direct URL navigation

Set **Drilldown URL** to any URL with token placeholders:

```
https://mysplunk.com/app/search/search?q=index%3Dmain%20icon%3D$icon$
```

Available tokens: `$icon$`, `$label$`, `$color$` — all URL-encoded by the viz before substitution.

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
    "drilldown": "all"
  },
  "eventHandlers": [{
    "type": "drilldown.setToken",
    "options": {
      "tokens": [{ "token": "selected_icon", "key": "icon" }]
    }
  }]
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
| 1.5.7 | Mirror app icons into `appserver/static/` so Splunk's REST static endpoint (`/servicesNS/nobody/icon_library/static/appIcon_2x.png`) serves them instead of returning 404. Top-level `static/` icons (used by the launcher) are unchanged. |
| 1.5.6 | Rewrite the in-app **README** dashboard: nine sections each with inline JSON / SPL examples, new dedicated section for Threshold Effects (icon swap, glow scale, pulse) with three live demo tiles, modernized Dashboard Studio schema (`tabs` + `layoutDefinitions`), generously sized markdown panels to eliminate scrollbars, and a "See Also" section pointing to the Service Health and Icon Showcase dashboards. |
| 1.5.5 | Add bundled **Service Health** use-case dashboard — six service tiles backed by `\| makeresults` SPL, demonstrating threshold colors, threshold effects (icon swap + glow scale + pulse on critical), and `drilldown.setToken` capturing the SPL `label` column into a token. Realistic 8-panel dashboard that loads in 2-3 seconds and gives Splunkbase visitors an immediate "I'd use this" example. |
| 1.5.4 | **Threshold effects** — per-band icon swap (e.g. `error` / `warning` / `check_circle` driven by the value), per-band glow-size scaling, and pulse animation on the critical band (configurable speed and band). Drilldown via Dashboard Studio `drilldown.setToken` now uses `"key": "icon"` (or `"label"` / `"color"`) to read the resolved values from a `{icon, label?, color?}` click payload. Pointer cursor auto-appears on panels with attached search data — no per-viz toggle. Refreshed in-app README dashboard and 256-icon showcase, each with live drilldown + threshold-effect demos. AppInspect-ready packaging. **Rendering performance pass**: data request reduced to `count: 1` (was `10000`), redundant re-renders skipped when config and data are unchanged, fallback-font render shows the panel immediately while Material Symbols loads (no blank period), font-load callbacks staggered across animation frames (8 panels per frame) to keep the main thread responsive on multi-panel dashboards, `devicePixelRatio` capped at 2, and the no-data placeholder observer narrowed to direct children + self-disconnects after first successful render. |
| 1.4.0 | **Threshold colors engine** — formatter section drives icon, label, glow, and background color from a numeric SPL column. Two configurable thresholds × three color pickers × direction (`high = good` or `high = bad`). Per-element apply toggles let Dashboard Studio DOS expressions on `iconColor` / `labelColor` / `glowColor` / `bgColor` flow through unchanged. Explicit SPL `color` column wins over the threshold engine. |
| 1.3.0 | **Initial public release** — 2,500+ Material Symbols icons rendered on Canvas 2D, with the icon font base64-embedded in `visualization.css` (no external network requests, Splunk Cloud compatible). Formatter controls for icon picker, custom icon name, color, background shape (circle / rounded rectangle / square), glow, shadow, label, alignment, rotation, and drilldown URL. Apache 2.0 license with full Material Symbols attribution in NOTICE. |

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
