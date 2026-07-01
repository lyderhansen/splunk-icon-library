# Icon Library — savedsearches.conf custom-viz option spec
#
# Custom visualization options accepted on saved searches and dashboard panels
# that use the icon_library.icon_library visualization type. All values are
# strings (Splunk persists them as such); the viz parses numerics and booleans
# at runtime.
#
# For programmatic dashboards (Dashboard Studio JSON), use the namespaced form
# "icon_library.icon_library.<key>" inside the panel's "options" object.


# --- Data configurations -----------------------------------------------------

display.visualizations.custom.icon_library.icon_library.iconName = <string>
display.visualizations.custom.icon_library.icon_library.customIcon = <string>


# --- Data display ------------------------------------------------------------

display.visualizations.custom.icon_library.icon_library.iconSize = <string>
display.visualizations.custom.icon_library.icon_library.hAlign = <string>
display.visualizations.custom.icon_library.icon_library.vAlign = <string>
display.visualizations.custom.icon_library.icon_library.rotation = <string>
display.visualizations.custom.icon_library.icon_library.showLabel = <string>
display.visualizations.custom.icon_library.icon_library.labelText = <string>
display.visualizations.custom.icon_library.icon_library.labelSize = <string>
display.visualizations.custom.icon_library.icon_library.labelColor = <string>


# --- Tooltip / theme ---------------------------------------------------------

display.visualizations.custom.icon_library.icon_library.tooltip = <string>
display.visualizations.custom.icon_library.icon_library.theme = <string>


# --- Icon style --------------------------------------------------------------

display.visualizations.custom.icon_library.icon_library.iconColor = <string>
display.visualizations.custom.icon_library.icon_library.bgShape = <string>
display.visualizations.custom.icon_library.icon_library.bgColor = <string>
display.visualizations.custom.icon_library.icon_library.bgOpacity = <string>
display.visualizations.custom.icon_library.icon_library.bgPadding = <string>
display.visualizations.custom.icon_library.icon_library.bgRadius = <string>
display.visualizations.custom.icon_library.icon_library.shadow = <string>
display.visualizations.custom.icon_library.icon_library.shadowColor = <string>
display.visualizations.custom.icon_library.icon_library.shadowBlur = <string>
display.visualizations.custom.icon_library.icon_library.shadowOffsetX = <string>
display.visualizations.custom.icon_library.icon_library.shadowOffsetY = <string>
display.visualizations.custom.icon_library.icon_library.glow = <string>
display.visualizations.custom.icon_library.icon_library.glowColor = <string>
display.visualizations.custom.icon_library.icon_library.glowSize = <string>


# --- Threshold colors --------------------------------------------------------

display.visualizations.custom.icon_library.icon_library.thresholdField = <string>
display.visualizations.custom.icon_library.icon_library.thresholdLow = <string>
display.visualizations.custom.icon_library.icon_library.thresholdHigh = <string>
display.visualizations.custom.icon_library.icon_library.thresholdDirection = <string>
display.visualizations.custom.icon_library.icon_library.thresholdColorLow = <string>
display.visualizations.custom.icon_library.icon_library.thresholdColorMid = <string>
display.visualizations.custom.icon_library.icon_library.thresholdColorHigh = <string>
display.visualizations.custom.icon_library.icon_library.colorIcon = <string>
display.visualizations.custom.icon_library.icon_library.colorLabel = <string>
display.visualizations.custom.icon_library.icon_library.colorGlow = <string>
display.visualizations.custom.icon_library.icon_library.colorBg = <string>
display.visualizations.custom.icon_library.icon_library.colorValue = <string>


# --- Value display (v1.7.0) --------------------------------------------------

display.visualizations.custom.icon_library.icon_library.showValue = <string>
display.visualizations.custom.icon_library.icon_library.valueField = <string>
display.visualizations.custom.icon_library.icon_library.valuePosition = <string>
display.visualizations.custom.icon_library.icon_library.valueSize = <string>
display.visualizations.custom.icon_library.icon_library.valueColor = <string>
display.visualizations.custom.icon_library.icon_library.valuePrefix = <string>
display.visualizations.custom.icon_library.icon_library.valueUnit = <string>
display.visualizations.custom.icon_library.icon_library.valueUnitPosition = <string>
display.visualizations.custom.icon_library.icon_library.valueFormat = <string>


# --- Trend (v1.7.0) ----------------------------------------------------------

display.visualizations.custom.icon_library.icon_library.showTrend = <string>
display.visualizations.custom.icon_library.icon_library.trendCompareBack = <string>
display.visualizations.custom.icon_library.icon_library.trendDirection = <string>
display.visualizations.custom.icon_library.icon_library.trendFormat = <string>
display.visualizations.custom.icon_library.icon_library.trendCaption = <string>


# --- Threshold effects (per band) --------------------------------------------

display.visualizations.custom.icon_library.icon_library.thresholdIconLow = <string>
display.visualizations.custom.icon_library.icon_library.thresholdIconMid = <string>
display.visualizations.custom.icon_library.icon_library.thresholdIconHigh = <string>
display.visualizations.custom.icon_library.icon_library.thresholdGlowScaleLow = <string>
display.visualizations.custom.icon_library.icon_library.thresholdGlowScaleMid = <string>
display.visualizations.custom.icon_library.icon_library.thresholdGlowScaleHigh = <string>
display.visualizations.custom.icon_library.icon_library.thresholdPulse = <string>
display.visualizations.custom.icon_library.icon_library.thresholdPulseSpeed = <string>
