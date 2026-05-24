# Icon Library — Reference

> Comprehensive reference for the `icon_library` Splunk Dashboard Studio custom visualization, focused on **drilldown** and **threshold colors** but covering the full configuration model. Written to be consumable by skill / agent training pipelines.

---

## What this viz is

A Splunk Dashboard Studio (v2) **custom visualization** that renders any of 2,500+ Material Symbols icons on a single Canvas surface, with:

- Static formatter-driven configuration (color, size, alignment, rotation, background shape, glow, shadow, label)
- Search-driven configuration via four optional SPL columns (`icon`, `color`, `label`, plus a configurable numeric threshold field — default `value`)
- A **threshold-coloring engine** that paints icon / label / glow / background colors based on a numeric SPL value, with three configurable bands
- **Click drilldown** that fires `FIELD_VALUE_DRILLDOWN` events for `drilldown.setToken` or direct URL navigation

The Material Symbols font is **base64-embedded** in `visualization.css` — no external network requests, Splunk Cloud compatible.

### Quick facts

| Property | Value |
|---|---|
| App ID | `icon_library` |
| Viz ID in JSON | `icon_library.icon_library` |
| Option key prefix | `icon_library.icon_library.` |
| Renderer | HTML5 Canvas 2D, single AMD module (ES5) |
| External dependencies | None at runtime |
| License | Apache 2.0 (font and code) |

---

## Installation

1. Install the `.tar.gz` from `dist/`:
   ```
   $SPLUNK_HOME/bin/splunk install app /path/to/icon_library-<version>.tar.gz
   ```
2. Restart Splunk Web (`splunk restart splunkweb`).
3. Hard-reload (Cmd+Shift+R / Ctrl+Shift+R) any open dashboard editor — Splunk caches custom-viz static assets aggressively.

---

## Configuration model — three layers

The viz reads options from three layers, in order of evaluation:

1. **Static formatter values.** Defined in `formatter.html`, edited in the panel's sidebar.
2. **Splunk Dashboard Studio Dynamic Options Syntax (DOS).** Any option can be replaced in the dashboard JSON with a `> primary | seriesByName(...) | rangeValue(...)`-style expression. The runtime resolves the expression before invoking `updateView`, so the viz sees the final hex value.
3. **SPL row data.** Specific columns (`icon`, `color`, `label`, and the configured threshold field) override the corresponding option at render time.

### Namespaced vs bare keys

In Dashboard Studio JSON, custom-viz options are namespaced with `icon_library.icon_library.`:

```json
"options": {
  "icon_library.icon_library.iconName": "rocket_launch",
  "icon_library.icon_library.iconColor": "#06B6D4"
}
```

Two **panel-level** keys are NOT namespaced — they belong to the panel itself, not the viz:

```json
"options": {
  "backgroundColor": "transparent",
  "drilldown": "all"
}
```

The viz reads `config[ns + key]` first and falls back to `config[key]`, so both forms work — but the documented contract uses namespaced for viz options and bare for the two panel options above.

### Mandatory panel option

**Always include `"backgroundColor": "transparent"` in panel `options`.** Dashboard Studio defaults custom-viz panels to a dark fill — without this, the icon sits on a black box.

---

## Drilldown

Drilldown is **automatic** as of v1.4.1 — there is no per-viz Enable Drilldown toggle. The viz fires a click event on every click; the dashboard decides whether to consume it.

### Path A — Dashboard Studio eventHandlers + setToken (recommended)

Two things must be set:

1. Panel options include `"drilldown": "all"`. Without it, Studio silently drops the click event.
2. The panel must be backed by a **real `ds.search`** (e.g. `| makeresults | eval icon="security"`). `ds.test` mock data does not propagate drilldown context — the click fires but no payload reaches the `setToken` handler.
3. An `eventHandlers` array with `drilldown.setToken` keyed on **`icon`** (the literal field name emitted in the payload). The viz emits `{icon: <iconName>, label?: <labelText>, color?: <hexColor>}` — Studio's setToken reads `key` against the literal payload-object key names. The older `click.value` syntax (native chart vizs) and `row.<field>.value` syntax (native table vizs) don't apply because we emit a different payload shape.

Canonical pattern:

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

The `tokens` array can declare multiple entries. The viz emits a payload with literal field-name → field-value pairs, and `key` in each token entry references a field name directly:

| Payload field (use as `key`) | Resolves to |
|---|---|
| `icon` | The resolved icon name (data-driven if SPL has an `icon` column, otherwise the formatter value) |
| `label` | The label text — only present when a label is rendered |
| `color` | The resolved icon color (hex) |

**Why not `click.value` / `row.<field>.value`?** The `click.*` namespace exists for Splunk's native chart visualizations (which emit a different payload shape). The `row.<field>.value` namespace exists for native table row clicks. Custom-viz `FIELD_VALUE_DRILLDOWN` payloads expose their literal data-object keys directly — `key: "icon"`, not `key: "value"`, not `key: "row.icon.value"`.

For tokens that need to survive across dashboard sessions, declare a default:

```json
"defaults": {
  "tokens": {
    "default": {
      "selected_icon": { "value": "(no selection)" }
    }
  }
}
```

The viz's click payload is a `FIELD_VALUE_DRILLDOWN` action with the shape:

```js
this.drilldown({
    action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
    data: { name: 'icon', value: '<resolvedIconName>' }
}, event);
```

This is the canonical Splunk shape — Studio reads the literal data-object keys (`name`, `value`) when resolving `setToken` `key` references.

### Path B — URL navigation

Set the **Drilldown URL** formatter option (or `icon_library.icon_library.drilldownUrl` in JSON) to any URL. Token placeholders are substituted with URL-encoded values at click time:

| Placeholder | Replaced with |
|---|---|
| `$icon$` | URL-encoded icon name |
| `$label$` | URL-encoded label text |
| `$color$` | URL-encoded icon color (hex) |

Example:

```json
"options": {
  "icon_library.icon_library.drilldownUrl":
    "https://splunk.example.com/app/search/search?q=index%3Dmain%20icon%3D$icon$",
  "icon_library.icon_library.drilldownNewTab": "yes"
}
```

When `drilldownUrl` is set, URL navigation runs **instead of** the `FIELD_VALUE_DRILLDOWN` event (URL wins over setToken). Set `drilldownNewTab` to `no` to navigate in the same tab.

### Cursor / affordance

The viz sets the panel cursor to `pointer` when either:

- `drilldownUrl` is non-empty, OR
- The panel option `drilldown` is set to anything other than `none` / `no` (i.e. `"all"`, `"row"`, or `"cell"`)

Otherwise the cursor remains default and clicks are no-ops.

### Gotchas

- **Missing `"drilldown": "all"` on the panel** is the #1 reason setToken doesn't fire. The viz emits the click but Studio drops it.
- **`"value": "$row.icon.value$"` in setToken tokens does NOT work.** `$row.*` is for native table-style vizs. Custom-viz drilldown exposes the payload as a flat object with literal field-name keys: `{icon, label?, color?}`. Use `{"token": "...", "key": "icon"}` to capture the icon name. The `click.value` form (from older Splunk docs) is also wrong for custom vizs.
- **`tokens` is an array of `{token, key}`** — not `{token, value}` with a `$...$` string. The `key` is bare (no dollar wrapping).
- **`javascript:` URLs** in `drilldownUrl` will execute on click. The viz does not currently filter URL schemes. If you're authoring shared dashboards, validate URLs externally.

---

## Threshold colors

The Threshold colors engine paints icon / label / glow / background colors based on a numeric SPL column. It produces three bands (low / mid / high) separated by two thresholds, optionally reversed for "high = bad" metrics.

### Mental model

```
        low band         mid band         high band
   ─────────────────|────────────────|─────────────
                   low              high
                threshold        threshold
                 (50)              (90)
```

Default direction is **high = good**: low band gets the *low* color (red), mid gets *mid* (amber), high gets *high* (green). Setting direction to `high_bad` flips the band colors so high band gets the low color (red), simulating an inverted RAG palette for metrics where "high = bad" (errors, latency).

### Formatter options

| Option (namespaced) | Default | Meaning |
|---|---|---|
| `thresholdField` | `value` | Name of the SPL column whose numeric value drives the rule |
| `thresholdLow` | `50` | Values strictly below this → low band |
| `thresholdHigh` | `90` | Values at or above this → high band. In-between → mid band. |
| `thresholdDirection` | `high_good` | `high_good` (uptime, score) or `high_bad` (errors, latency) |
| `thresholdColorLow` | `#EF4444` | Low band color (hex) |
| `thresholdColorMid` | `#F59E0B` | Mid band color (hex) |
| `thresholdColorHigh` | `#22C55E` | High band color (hex) |
| `colorIcon` | `yes` | Apply band color to the icon fill |
| `colorLabel` | `no` | Apply band color to the label text |
| `colorGlow` | `no` | Apply band color to the glow (only visible when `glow=yes`) |
| `colorBg` | `no` | Apply band color to the background shape (only visible when `bgShape != none`) |

### Precedence

Higher rules override lower ones for the icon's color:

1. **Explicit `color` SPL column** — always wins. Most-specific signal the search can send.
2. **Threshold band (when `colorIcon=yes`)** — wins over the static formatter color.
3. **DOS expression on `iconColor`** — flows through unchanged when `colorIcon=no`.
4. **Static formatter color picker** — the default fallback.

For `labelColor`, `glowColor`, `bgColor`, the same ordering applies relative to the corresponding `colorLabel` / `colorGlow` / `colorBg` toggle. There is no per-element "explicit override" SPL column for label/glow/bg, so the rules collapse to: threshold (if toggle yes) → DOS / static.

### Examples

**Basic — default thresholds, color the icon only.** No JSON changes needed; defaults reproduce RAG semantics. Just feed a `value` column.

```spl
| makeresults
| eval value = 97
```

→ Icon renders green (high band).

**Color icon + glow together.** Strong visual treatment for status tiles.

```json
"options": {
  "backgroundColor": "transparent",
  "icon_library.icon_library.customIcon": "monitor_heart",
  "icon_library.icon_library.glow": "yes",
  "icon_library.icon_library.glowSize": "14",
  "icon_library.icon_library.colorIcon": "yes",
  "icon_library.icon_library.colorGlow": "yes"
}
```

**Custom thresholds for latency (high = bad).**

```json
"options": {
  "icon_library.icon_library.thresholdField": "latency_ms",
  "icon_library.icon_library.thresholdLow": "200",
  "icon_library.icon_library.thresholdHigh": "500",
  "icon_library.icon_library.thresholdDirection": "high_bad"
}
```

With this configuration, `latency_ms < 200` paints green (good), `200–499` paints amber, `≥ 500` paints red.

**Driving via DOS instead of the formatter engine.** Disable the matching toggle so DOS wins:

```json
"options": {
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
```

The DOS expression supports the full Dashboard Studio expression vocabulary — `rangeValue`, `gradient`, `matchValue`, `formatByType`, etc. See Splunk's [Dashboard Studio Dynamic Options Syntax](https://docs.splunk.com/Documentation/Splunk/latest/DashStudio/dataviz) for the full grammar.

### Why two paths (formatter vs DOS)

- **Formatter:** No JSON required. Editable in the sidebar. Good for typical RAG cases. Limited to three bands.
- **DOS:** Requires editing JSON. Supports arbitrary band counts, named context blocks reusable across panels, gradient interpolation, and exact-string matching (`matchValue`). Mirrors what Splunk's native single-value gradient widget compiles down to behind the scenes.

Splunk does **not** expose its native gradient-bar formatter widget to custom visualizations — every custom viz pack rolls its own. The formatter engine here provides 90% of the common-case usability; DOS provides the escape hatch for the remaining 10%.

---

## Threshold effects (per band)

Sibling feature to threshold colors — drives non-color visual changes from the same band determination. Three independent effects: icon swap, glow scaling, pulse animation. Lives in the **Threshold effects** formatter section.

### Effect 1: Icon swap

Each band can override the icon name. When the band-specific input is non-empty, it replaces `resolvedIcon` after sanitization (lowercase + underscores). Empty fields fall through to the static `iconName` / `customIcon` / SPL `icon` column. Most-used pattern in monitoring dashboards:

| Band | Icon |
|---|---|
| Low (critical when High=good) | `error` |
| Mid (warning) | `warning` |
| High (healthy when High=good) | `check_circle` |

Formatter keys: `thresholdIconLow`, `thresholdIconMid`, `thresholdIconHigh`.

### Effect 2: Glow size per band

Each band has a multiplier on the base `glowSize`. Defaults to `1` (no change). Useful for "soft glow when healthy, intense glow when critical":

| Band | Multiplier | Effect |
|---|---|---|
| Low (critical) | `2` | Doubles the glow radius |
| Mid (warning) | `1` | No change |
| High (healthy) | `0.5` | Halves the glow radius |

Formatter keys: `thresholdGlowScaleLow`, `thresholdGlowScaleMid`, `thresholdGlowScaleHigh`. Applied via `glowSize = round(glowSize * scale)`. Set to `0` to disable glow entirely for a band.

### Effect 3: Pulse animation

When enabled, the glow radius is modulated by a sine wave around its base size, driven by a `requestAnimationFrame` loop. Configurable for which band(s) pulse and how fast.

| Formatter key | Default | Meaning |
|---|---|---|
| `thresholdPulse` | `no` | One of `no`, `critical`, `warning`, `critical_and_warning` |
| `thresholdPulseSpeed` | `1` | Pulses per second; values <0.1 clamped to default |

**Critical band semantics:**

| Direction | Critical band |
|---|---|
| `high_good` | Low band (value < `thresholdLow`) |
| `high_bad` | High band (value ≥ `thresholdHigh`) |

The pulse modulates `glowSize` by ±45% via `1 + 0.45 * sin(2π * phase)`. Phase advances at `thresholdPulseSpeed` Hz. The animation loop:

- Starts only when entering a pulse-eligible band
- Self-terminates on the next tick when the band changes
- Cancels its `requestAnimationFrame` on `destroy`
- Requires `glow: yes` — without glow, there's nothing to modulate visually

### Combining effects

Effects compose. A common SOC-status pattern:

```json
"options": {
  "backgroundColor": "transparent",
  "icon_library.icon_library.customIcon": "monitor_heart",
  "icon_library.icon_library.bgShape": "circle",
  "icon_library.icon_library.bgColor": "#0F172A",
  "icon_library.icon_library.bgPadding": "20",
  "icon_library.icon_library.glow": "yes",
  "icon_library.icon_library.glowSize": "14",
  "icon_library.icon_library.colorGlow": "yes",
  "icon_library.icon_library.thresholdIconLow":  "error",
  "icon_library.icon_library.thresholdIconMid":  "warning",
  "icon_library.icon_library.thresholdIconHigh": "check_circle",
  "icon_library.icon_library.thresholdGlowScaleLow": "2",
  "icon_library.icon_library.thresholdGlowScaleHigh": "0.6",
  "icon_library.icon_library.thresholdPulse": "critical",
  "icon_library.icon_library.thresholdPulseSpeed": "1.2"
}
```

Result: when the metric is healthy, `check_circle` icon with green soft glow (60% of base). Warning state: `warning` icon, amber normal glow. Critical state: `error` icon, red double-strength glow that pulses at 1.2 Hz.

### Direction handling

All three effects respect the `thresholdDirection` setting. When set to `high_bad`, the low/mid/high band assignments are flipped so the *worst* band gets the *low band's* icon/color/glow scale regardless of where on the numeric scale it falls. This means you only configure "the band for healthy values" / "for warning" / "for critical" once — the engine routes correctly for both directions.

---

## SPL row data overrides

When a search is attached, the viz reads `data.rows[0]` (the first row only — only one icon per panel) and looks at field names:

| SPL column | Effect |
|---|---|
| `icon` | Overrides the icon name. Sanitized to `lowercase_with_underscores`. |
| `color` | Overrides icon color (hex). **Beats the threshold engine.** |
| `label` | Sets label text and auto-enables label display (`showLabel=yes`). |
| `<thresholdField>` (default `value`) | Drives the threshold engine. |

All other fields are ignored.

### Renaming the threshold field

The field name is configurable. To drive thresholds from a column named `cpu_pct`:

```json
"options": {
  "icon_library.icon_library.thresholdField": "cpu_pct"
}
```

The SPL still uses `value` if that's what you've aliased — only the column the engine reads from is changed.

### Example SPL

```spl
| stats avg(uptime) AS value, latest(host) AS label BY service
| eval icon = case(value >= 99, "check_circle",
                   value >= 95, "warning",
                   true(),      "error")
| head 1
```

→ Single icon, threshold band picked from `value`, name auto-selected from the case expression, label set to host.

---

## Full configuration option reference

Names are unprefixed in this table — in Dashboard Studio JSON, prepend `icon_library.icon_library.`. In SPL data overrides, only the columns explicitly listed in **SPL row data overrides** above are honored.

### Data configurations

| Key | Default | Notes |
|---|---|---|
| `iconName` | `home` | Picks from a ~150-item dropdown of popular icons |
| `customIcon` | _(empty)_ | Any Material Symbols name. Overrides `iconName` when non-empty. |

### Data display

| Key | Default | Notes |
|---|---|---|
| `iconSize` | `0` | Pixels; `0` = auto-scale to panel |
| `hAlign` | `center` | `left`, `center`, `right` |
| `vAlign` | `center` | `top`, `center`, `bottom` |
| `rotation` | `0` | Degrees (0–360) |
| `showLabel` | `no` | `yes` / `no` |
| `labelText` | _(empty)_ | Static label text |
| `labelSize` | `0` | Pixels; `0` = auto-scale |
| `labelColor` | `#94A3B8` | Hex |
| `drilldownUrl` | _(empty)_ | URL with `$icon$`, `$label$`, `$color$` placeholders |
| `drilldownNewTab` | `yes` | Only relevant when `drilldownUrl` is set |

### Icon style

| Key | Default | Notes |
|---|---|---|
| `iconColor` | `#06B6D4` | Hex |
| `bgShape` | `none` | `none`, `circle`, `rounded_rect`, `square` |
| `bgColor` | `#1E293B` | Hex |
| `bgOpacity` | `1` | 0 to 1 |
| `bgPadding` | `16` | Pixels between icon and bg edge |
| `bgRadius` | `12` | Corner radius for `rounded_rect` |
| `shadow` | `no` | `yes` / `no` |
| `shadowColor` | `#000000` | Hex |
| `shadowBlur` | `8` | Pixels |
| `shadowOffsetX` | `0` | Pixels |
| `shadowOffsetY` | `4` | Pixels |
| `glow` | `no` | `yes` / `no` |
| `glowColor` | `#06B6D4` | Hex |
| `glowSize` | `12` | Pixels |

### Threshold colors

See the dedicated **Threshold colors** section above for the full table.

### Threshold effects

| Key | Default | Notes |
|---|---|---|
| `thresholdIconLow` | _(empty)_ | Icon name when band = low. Empty = no swap. |
| `thresholdIconMid` | _(empty)_ | Icon name when band = mid. |
| `thresholdIconHigh` | _(empty)_ | Icon name when band = high. |
| `thresholdGlowScaleLow` | `1` | Glow size multiplier for low band |
| `thresholdGlowScaleMid` | `1` | Glow size multiplier for mid band |
| `thresholdGlowScaleHigh` | `1` | Glow size multiplier for high band |
| `thresholdPulse` | `no` | `no` / `critical` / `warning` / `critical_and_warning` |
| `thresholdPulseSpeed` | `1` | Pulses per second |

### Panel-level (not namespaced)

| Key | Required value | Why |
|---|---|---|
| `backgroundColor` | `"transparent"` | Avoids the dark default panel fill behind the viz |
| `drilldown` | `"all"` | Required for `eventHandlers.drilldown.setToken` to fire |

---

## Canonical Dashboard Studio JSON patterns

### 1. Static decorative icon (no search)

```json
"viz_logo": {
  "type": "icon_library.icon_library",
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "rocket_launch",
    "icon_library.icon_library.iconColor": "#06B6D4"
  }
}
```

### 2. Status tile with threshold-driven glow

```json
"viz_uptime": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_uptime" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "monitor_heart",
    "icon_library.icon_library.bgShape": "circle",
    "icon_library.icon_library.bgColor": "#0F172A",
    "icon_library.icon_library.bgPadding": "20",
    "icon_library.icon_library.glow": "yes",
    "icon_library.icon_library.glowSize": "14",
    "icon_library.icon_library.colorGlow": "yes",
    "icon_library.icon_library.thresholdField": "uptime_pct",
    "icon_library.icon_library.thresholdLow": "95",
    "icon_library.icon_library.thresholdHigh": "99"
  }
}
```

### 3. Drilldown that sets a token, consumed by an SPL panel

```json
"viz_clickable": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_event" },
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

Downstream search consuming the token:

```spl
index=main icon=$selected_icon|s$
| stats count
```

### 4. Drilldown opens a Splunk search in a new tab

```json
"viz_open_search": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_event" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.iconColor": "#F59E0B",
    "icon_library.icon_library.drilldownUrl":
      "/app/search/search?q=index%3Dmain%20icon%3D$icon$",
    "icon_library.icon_library.drilldownNewTab": "yes"
  }
}
```

### 5. DOS-driven gradient color, threshold engine disabled

```json
"viz_dos_color": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_health" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "monitor_heart",
    "icon_library.icon_library.iconColor":
      "> primary | seriesByName('score') | lastPoint() | rangeValue(scoreColors)",
    "icon_library.icon_library.colorIcon": "no"
  },
  "context": {
    "scoreColors": [
      { "to": 50,             "value": "#EF4444" },
      { "from": 50, "to": 80, "value": "#F59E0B" },
      { "from": 80,           "value": "#22C55E" }
    ]
  }
}
```

### 6. Combination — threshold-driven color + drilldown + label

```json
"viz_full": {
  "type": "icon_library.icon_library",
  "dataSources": { "primary": "ds_service" },
  "options": {
    "backgroundColor": "transparent",
    "icon_library.icon_library.customIcon": "monitor_heart",
    "icon_library.icon_library.showLabel": "yes",
    "icon_library.icon_library.labelText": "Service health",
    "icon_library.icon_library.bgShape": "circle",
    "icon_library.icon_library.bgColor": "#0F172A",
    "icon_library.icon_library.bgPadding": "20",
    "icon_library.icon_library.glow": "yes",
    "icon_library.icon_library.glowSize": "14",
    "icon_library.icon_library.colorIcon": "yes",
    "icon_library.icon_library.colorGlow": "yes",
    "icon_library.icon_library.thresholdLow": "60",
    "icon_library.icon_library.thresholdHigh": "90",
    "drilldown": "all"
  },
  "eventHandlers": [{
    "type": "drilldown.setToken",
    "options": {
      "tokens": [{ "token": "selected_service", "key": "icon" }]
    }
  }]
}
```

---

## Gotchas — by frequency observed

1. **Black box behind the icon.** Missing `"backgroundColor": "transparent"` in the panel `options`.
2. **Drilldown setToken silently does nothing.** Missing `"drilldown": "all"` in the panel `options`.
3. **`$row.icon.value$` doesn't resolve, and neither does `$click.value$`.** Custom-viz drilldown emits a `{icon, label?, color?}` payload — the setToken `key` references a literal field of that object directly. Use `{"token": "...", "key": "icon"}`.
4. **Threshold colors don't change.** Either the SPL doesn't include the configured `thresholdField`, or the per-element toggle (`colorIcon` etc.) is set to `no`, or an explicit `color` SPL column is overriding it.
5. **DOS expression overridden.** The matching toggle (`colorIcon`/`colorLabel`/`colorGlow`/`colorBg`) is set to `yes` and the threshold engine is rewriting the DOS-resolved color. Set it to `no` when DOS is in use.
6. **Icon name not recognized.** Names must be `lowercase_with_underscores`. The sanitizer strips other characters silently. Use `mode_heat_off`, not `Mode Heat Off` or `mode-heat-off`.
7. **Formatter changes don't appear after re-install.** Splunk caches custom viz static assets. Restart `splunkweb` and hard-reload the browser.
8. **`tokens` written as `{token, value}` with `$...$`.** Studio rejects this shape for `drilldown.setToken`. Use `{token, key}` where `key` is bare.

---

## Version history (drilldown + threshold timeline)

| Version | Relevant changes |
|---|---|
| 1.5.0 | Threshold effects section — per-band icon swap, glow scaling, and pulse animation. Pulse uses `requestAnimationFrame` with `cancelAnimationFrame` cleanup on destroy. Critical-band semantics auto-track threshold direction. |
| 1.4.0 | Threshold colors engine introduced (formatter section + 10 controls). DOS pass-through honored via per-element toggles. Explicit `color` SPL column wins over threshold. |
| 1.4.1 | "Enable Drilldown" formatter toggle removed. Drilldown now auto-activates from `"drilldown": "all"` on the panel or a non-empty `drilldownUrl`. |
| 1.4.2 | Formatter section renamed from "Color and style" → "Icon style" to avoid collision with Splunk's native panel section. |
| 1.4.3 | In-app README dashboard rewritten with live drilldown demo + three live threshold-band tiles. |
| 1.4.4 | `appIconAlt.png` / `appIconAlt_2x.png` added (placeholders mirroring the primary icons). |

Earlier versions covered: drilldown payload shape fix (1.3.4), Apache 2.0 relicense + NOTICE (1.3.3), and core feature set (1.0.0–1.3.0).

---

## Source layout (for skill/agent context)

```
icon_library/
├── appserver/static/visualizations/icon_library/
│   ├── src/visualization_source.js     # AMD module, all rendering + drilldown logic
│   ├── visualization.js                # Webpack bundle (built)
│   ├── visualization.css               # Base64-embedded Material Symbols font (generated)
│   ├── formatter.html                  # Formatter sidebar UI (sections + controls)
│   ├── fonts/                          # Source woff2 + embed-font.sh regen script
│   └── webpack.config.js
├── default/
│   ├── app.conf                        # version source of truth
│   ├── visualizations.conf             # registers the viz with Splunk
│   └── data/ui/views/
│       ├── readme.xml                  # in-app README dashboard with live demos
│       └── showcase.xml                # 256-icon visual showcase
├── static/                             # appIcon, appIcon_2x, appIconAlt, appIconAlt_2x
├── metadata/default.meta
├── _generate_showcase.py               # regenerates showcase.xml
├── build.sh                            # packages dist/icon_library-<version>.tar.gz
├── LICENSE                             # Apache 2.0
├── NOTICE                              # Third-party attributions
└── README.md
```

The entire viz is one source file (`visualization_source.js`, ~550 lines including the threshold engine and drilldown handler) and one formatter HTML. There is no test suite — verification is via the README and showcase dashboards rendered inside Splunk.
