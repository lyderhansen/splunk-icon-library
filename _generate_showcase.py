#!/usr/bin/env python3
"""Generate a 250-icon showcase dashboard for icon_library."""
import json, textwrap

NS = "icon_library.icon_library."

# ── Section definitions ──────────────────────────────────────────
# Each section: (title, description, icons_with_overrides)
# icon entry: (icon_name, {extra_options})

COLORS = [
    "#06B6D4", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#F8FAFC", "#14B8A6", "#F97316",
    "#A855F7", "#6366F1", "#10B981", "#E11D48", "#0EA5E9",
    "#84CC16", "#D946EF", "#FB923C", "#64748B", "#FBBF24",
]

BG_COLORS = ["#1E293B", "#0F172A", "#1A1A2E", "#164E63", "#312E81", "#18181B"]
GLOW_COLORS = ["#06B6D4", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#F8FAFC"]

SECTIONS = []

# ─── 1. Color Palette (20 icons) ─────────────────────────────────
sec1 = []
color_icons = [
    "home", "star", "favorite", "bolt", "rocket_launch",
    "diamond", "light_mode", "dark_mode", "palette", "brush",
    "water_drop", "eco", "local_fire_department", "ac_unit", "sunny",
    "nightlight", "cloud", "thunderstorm", "looks", "grade",
]
for i, icon in enumerate(color_icons):
    sec1.append((icon, {"iconColor": COLORS[i % len(COLORS)]}))
SECTIONS.append(("Color Palette", "20 icons in vibrant colors", sec1))

# ─── 2. Background: Circle (18 icons) ────────────────────────────
sec2 = []
circle_icons = [
    "check_circle", "cancel", "info", "warning", "error", "help",
    "verified_user", "gpp_good", "gpp_bad", "shield",
    "security", "lock", "vpn_key", "fingerprint", "key",
    "admin_panel_settings", "policy", "rule",
]
for i, icon in enumerate(circle_icons):
    sec2.append((icon, {
        "bgShape": "circle",
        "bgColor": BG_COLORS[i % len(BG_COLORS)],
        "iconColor": COLORS[i % len(COLORS)],
        "bgPadding": "20",
    }))
SECTIONS.append(("Circle Backgrounds", "Icons with circular background shapes", sec2))

# ─── 3. Background: Rounded Rectangle (16 icons) ─────────────────
sec3 = []
rrect_icons = [
    "person", "group", "account_circle", "badge", "contacts",
    "school", "work", "business", "apartment", "factory",
    "store", "local_hospital", "science", "biotech",
    "psychology", "health_and_safety",
]
for i, icon in enumerate(rrect_icons):
    sec3.append((icon, {
        "bgShape": "rounded_rect",
        "bgColor": BG_COLORS[i % len(BG_COLORS)],
        "bgRadius": str(8 + (i % 4) * 4),
        "iconColor": COLORS[(i + 5) % len(COLORS)],
        "bgPadding": "18",
    }))
SECTIONS.append(("Rounded Rectangle Backgrounds", "Icons with rounded rect backgrounds and varying corner radius", sec3))

# ─── 4. Background: Square (14 icons) ────────────────────────────
sec4 = []
square_icons = [
    "dashboard", "analytics", "insights", "trending_up", "trending_down",
    "bar_chart", "pie_chart", "show_chart", "monitor_heart", "speed",
    "data_object", "api", "schema", "integration_instructions",
]
for i, icon in enumerate(square_icons):
    sec4.append((icon, {
        "bgShape": "square",
        "bgColor": BG_COLORS[i % len(BG_COLORS)],
        "iconColor": COLORS[(i + 3) % len(COLORS)],
        "bgPadding": "16",
    }))
SECTIONS.append(("Square Backgrounds", "Icons with square background shapes", sec4))

# ─── 5. Glow Effects (18 icons) ──────────────────────────────────
sec5 = []
glow_icons = [
    "electric_bolt", "flash_on", "power", "solar_power", "wind_power",
    "energy_savings_leaf", "battery_charging_full", "ev_station",
    "cell_tower", "signal_cellular_alt", "wifi", "bluetooth",
    "nfc", "sensors", "radar", "satellite_alt", "hub", "lan",
]
for i, icon in enumerate(glow_icons):
    gc = GLOW_COLORS[i % len(GLOW_COLORS)]
    sec5.append((icon, {
        "iconColor": gc,
        "glow": "yes",
        "glowColor": gc,
        "glowSize": str(10 + (i % 5) * 4),
    }))
SECTIONS.append(("Glow Effects", "Icons with neon glow in various colors and intensities", sec5))

# ─── 6. Shadow Effects (16 icons) ────────────────────────────────
sec6 = []
shadow_icons = [
    "flight", "local_shipping", "directions_car", "train",
    "directions_boat", "two_wheeler", "pedal_bike", "airport_shuttle",
    "rocket", "paragliding", "kitesurfing", "surfing",
    "snowboarding", "skateboarding", "sports_esports", "sports_soccer",
]
for i, icon in enumerate(shadow_icons):
    sec6.append((icon, {
        "iconColor": COLORS[i % len(COLORS)],
        "shadow": "yes",
        "shadowColor": "#000000",
        "shadowBlur": str(6 + (i % 4) * 3),
        "shadowOffsetX": str((i % 3) * 2),
        "shadowOffsetY": str(2 + (i % 4) * 2),
    }))
SECTIONS.append(("Shadow Effects", "Icons with drop shadows of varying depth", sec6))

# ─── 7. With Labels (20 icons) ───────────────────────────────────
sec7 = []
label_data = [
    ("notifications_active", "Alerts"), ("email", "Email"), ("chat", "Messages"),
    ("phone", "Calls"), ("videocam", "Video"), ("mic", "Audio"),
    ("forum", "Forums"), ("campaign", "Campaign"), ("newspaper", "News"),
    ("feed", "Feed"), ("rss_feed", "RSS"), ("podcasts", "Podcasts"),
    ("radio", "Radio"), ("music_note", "Music"), ("headphones", "Listen"),
    ("volume_up", "Volume"), ("graphic_eq", "Equalizer"), ("audiotrack", "Track"),
    ("library_music", "Library"), ("queue_music", "Queue"),
]
for i, (icon, lbl) in enumerate(label_data):
    sec7.append((icon, {
        "iconColor": COLORS[i % len(COLORS)],
        "showLabel": "yes",
        "labelText": lbl,
        "labelColor": "#94A3B8",
    }))
SECTIONS.append(("Icons with Labels", "Every icon paired with a descriptive label", sec7))

# ─── 8. Labels + Background (16 icons) ───────────────────────────
sec8 = []
label_bg_data = [
    ("memory", "RAM"), ("developer_board", "CPU"), ("storage", "Disk"),
    ("dns", "DNS"), ("cloud", "Cloud"), ("database", "DB"),
    ("terminal", "CLI"), ("code", "Code"), ("bug_report", "Bugs"),
    ("build", "Build"), ("construction", "Deploy"), ("engineering", "Eng"),
    ("troubleshoot", "Debug"), ("network_check", "Net"), ("hub", "Hub"),
    ("router", "Router"),
]
shapes = ["circle", "rounded_rect", "square"]
for i, (icon, lbl) in enumerate(label_bg_data):
    sec8.append((icon, {
        "iconColor": COLORS[(i + 2) % len(COLORS)],
        "showLabel": "yes",
        "labelText": lbl,
        "labelColor": "#CBD5E1",
        "bgShape": shapes[i % len(shapes)],
        "bgColor": BG_COLORS[i % len(BG_COLORS)],
        "bgPadding": "14",
    }))
SECTIONS.append(("Labels inside Background Shapes", "Icons with labels contained within background shapes", sec8))

# ─── 9. Glow + Background (14 icons) ─────────────────────────────
sec9 = []
glow_bg_icons = [
    "security", "shield", "verified_user", "lock", "fingerprint",
    "vpn_key", "gpp_good", "admin_panel_settings", "policy",
    "emergency", "crisis_alert", "report", "warning", "error",
]
for i, icon in enumerate(glow_bg_icons):
    gc = GLOW_COLORS[i % len(GLOW_COLORS)]
    sec9.append((icon, {
        "iconColor": gc,
        "glow": "yes",
        "glowColor": gc,
        "glowSize": "14",
        "bgShape": "circle",
        "bgColor": "#0F172A",
        "bgPadding": "18",
    }))
SECTIONS.append(("Glow with Background", "Neon glow icons on dark circular backgrounds", sec9))

# ─── 10. Alignment Variations (12 icons) ─────────────────────────
sec10 = []
aligns = [
    ("left", "top"), ("center", "top"), ("right", "top"),
    ("left", "center"), ("center", "center"), ("right", "center"),
    ("left", "bottom"), ("center", "bottom"), ("right", "bottom"),
    ("left", "top"), ("right", "bottom"), ("center", "center"),
]
align_icons = [
    "arrow_back", "arrow_upward", "arrow_forward",
    "chevron_left", "adjust", "chevron_right",
    "south_west", "arrow_downward", "south_east",
    "north_west", "south_east", "center_focus_strong",
]
for i, icon in enumerate(align_icons):
    ha, va = aligns[i]
    sec10.append((icon, {
        "iconColor": COLORS[i % len(COLORS)],
        "hAlign": ha,
        "vAlign": va,
        "bgShape": "square",
        "bgColor": "#1A1A2E",
        "bgPadding": "8",
    }))
SECTIONS.append(("Alignment Grid", "Icons positioned using horizontal and vertical alignment", sec10))

# ─── 11. Rotation (12 icons) ─────────────────────────────────────
sec11 = []
rot_icons = [
    "navigation", "arrow_upward", "send", "play_arrow",
    "forward", "redo", "refresh", "sync",
    "rotate_right", "autorenew", "loop", "cached",
]
for i, icon in enumerate(rot_icons):
    sec11.append((icon, {
        "iconColor": COLORS[i % len(COLORS)],
        "rotation": str(i * 30),
    }))
SECTIONS.append(("Rotation", "Icons rotated at 30-degree increments (0 to 330)", sec11))

# ─── 12. Network & Cloud (16 icons) ──────────────────────────────
sec12 = []
net_icons = [
    "wifi", "wifi_off", "signal_cellular_alt", "cell_tower",
    "lan", "cable", "router", "hub",
    "cloud", "cloud_upload", "cloud_download", "cloud_off",
    "public", "language", "dns", "vpn_lock",
]
for i, icon in enumerate(net_icons):
    sec12.append((icon, {
        "iconColor": "#06B6D4" if i < 8 else "#3B82F6",
        "bgShape": "rounded_rect",
        "bgColor": "#0F172A",
        "bgPadding": "14",
        "bgRadius": "10",
    }))
SECTIONS.append(("Network and Cloud", "Network infrastructure and cloud service icons", sec12))

# ─── 13. Devices (14 icons) ──────────────────────────────────────
sec13 = []
dev_icons = [
    "computer", "laptop", "smartphone", "tablet",
    "monitor", "tv", "watch", "mouse",
    "keyboard", "headphones", "camera", "videocam",
    "print", "speaker",
]
for i, icon in enumerate(dev_icons):
    sec13.append((icon, {
        "iconColor": "#F8FAFC",
        "shadow": "yes",
        "shadowBlur": "6",
        "shadowOffsetY": "3",
        "bgShape": "rounded_rect",
        "bgColor": "#312E81",
        "bgPadding": "16",
        "bgRadius": "12",
    }))
SECTIONS.append(("Devices and Hardware", "Device icons on indigo backgrounds", sec13))

# ─── 14. Files & Content (14 icons) ──────────────────────────────
sec14 = []
file_icons = [
    "folder", "folder_open", "folder_shared", "create_new_folder",
    "description", "article", "note", "sticky_note_2",
    "upload_file", "download", "file_copy", "attachment",
    "link", "bookmark",
]
for i, icon in enumerate(file_icons):
    sec14.append((icon, {
        "iconColor": COLORS[(i + 8) % len(COLORS)],
    }))
SECTIONS.append(("Files and Content", "Document and file management icons", sec14))

# ─── 15. Combo: Glow + Shadow + Label + BG (14 icons) ────────────
sec15 = []
combo_data = [
    ("rocket_launch", "Launch", "#EF4444"),
    ("task_alt", "Complete", "#22C55E"),
    ("pending", "Pending", "#F59E0B"),
    ("hourglass_empty", "Waiting", "#06B6D4"),
    ("flag", "Flagged", "#EC4899"),
    ("military_tech", "Awarded", "#FBBF24"),
    ("emoji_events", "Winner", "#F97316"),
    ("workspace_premium", "Premium", "#8B5CF6"),
    ("token", "Token", "#14B8A6"),
    ("deployed_code", "Deployed", "#10B981"),
    ("celebration", "Party", "#D946EF"),
    ("thumb_up", "Approved", "#22C55E"),
    ("thumb_down", "Rejected", "#EF4444"),
    ("mood", "Happy", "#FBBF24"),
]
for i, (icon, lbl, color) in enumerate(combo_data):
    sec15.append((icon, {
        "iconColor": color,
        "glow": "yes",
        "glowColor": color,
        "glowSize": "10",
        "shadow": "yes",
        "shadowBlur": "8",
        "shadowOffsetY": "4",
        "showLabel": "yes",
        "labelText": lbl,
        "labelColor": "#CBD5E1",
        "bgShape": "rounded_rect",
        "bgColor": "#0F172A",
        "bgPadding": "14",
        "bgRadius": "14",
    }))
SECTIONS.append(("Full Combo: Glow + Shadow + Label + Background", "All effects combined for maximum visual impact", sec15))

# ─── 16. Status Indicators (12 icons) ────────────────────────────
sec16 = []
status_data = [
    ("check_circle", "#22C55E"), ("cancel", "#EF4444"),
    ("warning", "#F59E0B"), ("error", "#EF4444"),
    ("info", "#3B82F6"), ("help", "#8B5CF6"),
    ("pending", "#64748B"), ("schedule", "#06B6D4"),
    ("update", "#14B8A6"), ("published_with_changes", "#F97316"),
    ("do_not_disturb_on", "#EF4444"), ("new_releases", "#22C55E"),
]
for i, (icon, color) in enumerate(status_data):
    sec16.append((icon, {
        "iconColor": color,
        "bgShape": "circle",
        "bgColor": "#18181B",
        "bgPadding": "16",
        "glow": "yes",
        "glowColor": color,
        "glowSize": "8",
    }))
SECTIONS.append(("Status Indicators", "RAG status icons with matching glow on dark circles", sec16))

# ─── 17. Misc / Fun (10 icons) ───────────────────────────────────
sec17 = []
fun_icons = [
    ("pets", "#F97316"), ("spa", "#EC4899"), ("self_improvement", "#8B5CF6"),
    ("cookie", "#FBBF24"), ("cake", "#EC4899"), ("local_cafe", "#A0522D"),
    ("local_bar", "#06B6D4"), ("restaurant", "#EF4444"),
    ("beach_access", "#F59E0B"), ("pool", "#3B82F6"),
]
for icon, color in fun_icons:
    sec17.append((icon, {"iconColor": color}))
SECTIONS.append(("Fun and Lifestyle", "Playful icons for dashboards with personality", sec17))

# ── Count total icons ────────────────────────────────────────────
total = sum(len(s[2]) for s in SECTIONS)
print(f"Total icons: {total}")

# ── Build dashboard JSON ─────────────────────────────────────────
COLS = 14
PW, PH = 120, 120
GAP = 10
CANVAS_W = 1920
START_X = (CANVAS_W - (COLS * PW + (COLS - 1) * GAP)) // 2
HEADER_H = 50
SECTION_GAP = 24

data_sources = {
    "ds_stub": {
        "type": "ds.test",
        "options": {"data": {"fields": [{"name": "stub"}], "columns": [["1"]]}},
        "name": "Stub for icon rendering",
    }
}

visualizations = {}
structure = []
y_cursor = 20

for sec_idx, (title, desc, icons) in enumerate(SECTIONS):
    # Section header (markdown)
    hdr_id = f"viz_hdr_{sec_idx}"
    visualizations[hdr_id] = {
        "type": "splunk.markdown",
        "options": {
            "markdown": f"### {title}\n{desc}",
            "fontColor": "#E2E8F0",
            "backgroundColor": "transparent",
        },
    }
    structure.append({
        "item": hdr_id,
        "type": "block",
        "position": {"x": START_X, "y": y_cursor, "w": CANVAS_W - 2 * START_X, "h": HEADER_H},
    })
    y_cursor += HEADER_H + 4

    for i, (icon_name, opts) in enumerate(icons):
        col = i % COLS
        row = i // COLS
        x = START_X + col * (PW + GAP)
        y = y_cursor + row * (PH + GAP)

        vid = f"viz_s{sec_idx}_{i}"

        viz_options = {"backgroundColor": "transparent", NS + "iconName": icon_name}
        for k, v in opts.items():
            viz_options[NS + k] = v

        visualizations[vid] = {
            "type": "icon_library.icon_library",
            "dataSources": {"primary": "ds_stub"},
            "options": viz_options,
        }
        structure.append({
            "item": vid,
            "type": "block",
            "position": {"x": x, "y": y, "w": PW, "h": PH},
        })

    rows_needed = (len(icons) + COLS - 1) // COLS
    y_cursor += rows_needed * (PH + GAP) + SECTION_GAP

canvas_h = y_cursor + 40

dashboard = {
    "title": "Icon Library Showcase — 250 Icons",
    "description": "Comprehensive showcase of icon_library visualization settings: colors, backgrounds, glow, shadow, labels, alignment, rotation, and combined effects.",
    "dataSources": data_sources,
    "defaults": {},
    "visualizations": visualizations,
    "layout": {
        "type": "absolute",
        "options": {
            "width": CANVAS_W,
            "height": canvas_h,
            "display": "auto-scale",
            "backgroundColor": "#101014",
        },
        "globalInputs": [],
        "structure": structure,
    },
}

json_str = json.dumps(dashboard, indent=2)

xml = textwrap.dedent(f"""\
<dashboard version="2" theme="dark">
  <label>Icon Library Showcase</label>
  <description>250 Material Symbols icons with different colors, backgrounds, glow, shadow, labels, alignment, rotation, and combined effects</description>
  <definition><![CDATA[
{json_str}
]]></definition>
</dashboard>
""")

out_path = "default/data/ui/views/showcase.xml"
with open(out_path, "w") as f:
    f.write(xml)

print(f"Written {out_path}  ({len(xml):,} bytes, canvas {CANVAS_W}x{canvas_h})")
print(f"Sections: {len(SECTIONS)}, Panels: {len(visualizations)}, Layout items: {len(structure)}")
