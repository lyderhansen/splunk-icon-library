#!/usr/bin/env python3
"""Generate a benchmark dashboard with 250 native splunk.singlevalue panels.

Run:
    python3 benchmarks/_generate_native_benchmark.py

Produces: benchmarks/native_singlevalue_250.xml

Install in Splunk by either:
  a) Copy native_singlevalue_250.xml to
     $SPLUNK_HOME/etc/apps/search/local/data/ui/views/
     then restart splunkweb (or reload via REST).
  b) Open Dashboard Studio in Splunk, "Create new" -> "Source"
     -> paste the contents of the file -> Save.

Purpose: compare cold-load time of 250 NATIVE single-value panels vs
the 256-panel icon_library showcase. Same data-source pattern (ds.test
with one stub row), same canvas width, same grid geometry. If native
panels also take ~60s, Splunk's per-panel mount cost is independent
of custom-viz iframes. If they load in <5s, the iframe-per-panel model
is the specific bottleneck for custom vizs.
"""
import json
import textwrap

PANEL_COUNT = 250
COLS = 14
PW, PH = 120, 120
GAP = 10
CANVAS_W = 1920
START_X = (CANVAS_W - (COLS * PW + (COLS - 1) * GAP)) // 2
HEADER_H = 50
TOP_PAD = 60

# Single shared data source — every panel reads the same one row.
# This eliminates per-panel search dispatch from the measurement and
# isolates the rendering / mount overhead.
data_sources = {
    "ds_shared": {
        "type": "ds.test",
        "options": {
            "data": {
                "fields": [{"name": "value"}],
                "columns": [["42"]],
            }
        },
        "name": "Shared stub — value=42",
    }
}

visualizations = {
    "viz_header": {
        "type": "splunk.markdown",
        "options": {
            "markdown": (
                f"# Native Single-Value Benchmark — {PANEL_COUNT} panels\n"
                "Each panel is a `splunk.singlevalue` reading the same `ds.test` "
                "stub data source. Use this to compare cold-load time against the "
                f"`{PANEL_COUNT}`-panel icon_library showcase. Hard-reload the page "
                "to measure first paint; watch the bottom-bar Finish timer in "
                "DevTools Network for the wall-clock load time."
            ),
            "fontColor": "#E2E8F0",
            "backgroundColor": "transparent",
        },
    }
}

structure = [
    {
        "item": "viz_header",
        "type": "block",
        "position": {"x": START_X, "y": 20, "w": CANVAS_W - 2 * START_X, "h": HEADER_H},
    }
]

y0 = TOP_PAD + HEADER_H

for i in range(PANEL_COUNT):
    col = i % COLS
    row = i // COLS
    x = START_X + col * (PW + GAP)
    y = y0 + row * (PH + GAP)
    vid = f"viz_sv_{i:03d}"
    visualizations[vid] = {
        "type": "splunk.singlevalue",
        "dataSources": {"primary": "ds_shared"},
        "options": {
            "backgroundColor": "transparent",
            "majorColor": "#06B6D4",
            "underLabel": f"#{i+1}",
        },
    }
    structure.append({
        "item": vid,
        "type": "block",
        "position": {"x": x, "y": y, "w": PW, "h": PH},
    })

rows_used = (PANEL_COUNT + COLS - 1) // COLS
canvas_h = y0 + rows_used * (PH + GAP) + 40

dashboard = {
    "title": f"Native Single-Value Benchmark — {PANEL_COUNT} panels",
    "description": (
        f"{PANEL_COUNT} native splunk.singlevalue panels using a shared ds.test "
        "source. For benchmarking custom-viz iframe cost vs native panel mount cost."
    ),
    "dataSources": data_sources,
    "defaults": {},
    "visualizations": visualizations,
    "inputs": {},
    # Modern Dashboard Studio schema requires layoutDefinitions + tabs.
    # Single-tab layout: declare one layoutId in layoutDefinitions, reference it once in tabs.items.
    "layout": {
        "tabs": {
            "items": [
                {"label": "Benchmark", "layoutId": "layout_1"}
            ]
        },
        "layoutDefinitions": {
            "layout_1": {
                "type": "absolute",
                "options": {
                    "width": CANVAS_W,
                    "height": canvas_h,
                    "display": "auto-scale",
                    "backgroundColor": "#101014",
                },
                "structure": structure,
                "globalInputs": [],
            }
        },
    },
    "applicationProperties": {"theme": "dark"},
}

json_str = json.dumps(dashboard, indent=2)

xml = textwrap.dedent(f"""\
<dashboard version="2" theme="dark">
  <label>Native Single-Value Benchmark — {PANEL_COUNT} panels</label>
  <description>{PANEL_COUNT} native splunk.singlevalue panels for benchmarking against the icon_library showcase</description>
  <definition><![CDATA[
{json_str}
]]></definition>
</dashboard>
""")

out = f"benchmarks/native_singlevalue_{PANEL_COUNT}.xml"
with open(out, "w") as f:
    f.write(xml)

print(f"Written {out}  ({len(xml):,} bytes, canvas {CANVAS_W}x{canvas_h})")
print(f"Panels: {PANEL_COUNT}, layout items: {len(structure)}")
