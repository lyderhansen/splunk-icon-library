/*
 * Icon Library — Splunk Custom Visualization
 *
 * Renders Material Symbols icons on a Canvas with configurable color,
 * size, background shape, shadow, glow, label, and data-driven styling.
 * Click drilldown uses Splunk's native FIELD_VALUE_DRILLDOWN event;
 * wire it via Dashboard Studio's drilldown.setToken eventHandler.
 *
 * Expected SPL columns (all optional):
 *   icon   — Material Symbols icon name (e.g. "home", "security")
 *   color  — hex colour override for the icon
 *   label  — text label below the icon
 *   value  — numeric value for threshold-based colouring
 */
define([
    'api/SplunkVisualizationBase'
], function(SplunkVisualizationBase) {

    // ── Config helper ───────────────────────────────────────────

    function getOption(config, ns, key, defaultValue) {
        var v = config[ns + key];
        if (v !== undefined && v !== null) return v;
        v = config[key];
        if (v !== undefined && v !== null) return v;
        return defaultValue;
    }

    function getNS(viz) {
        try {
            var info = viz.getPropertyNamespaceInfo();
            if (info && info.propertyNamespace) return info.propertyNamespace;
        } catch (e) { /* harness or early call */ }
        return '';
    }

    // ── Colour utilities ────────────────────────────────────────

    function hexToRgba(hex, alpha) {
        if (!hex || hex === 'transparent') return 'rgba(0,0,0,0)';
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    // ── Icon name sanitiser ─────────────────────────────────────

    function sanitizeIconName(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }

    // ── Theme detection ─────────────────────────────────────────

    // Returns 'dark' or 'light' based on Splunk's themed wrapper classes
    // and a luminance fallback. Used to swap factory-default label/bg
    // colours so the viz looks right on both light and dark dashboards
    // without per-panel reconfiguration.
    function detectTheme() {
        if (typeof document === 'undefined') return 'dark';
        var html = document.documentElement;
        var body = document.body;
        var classes = ((html && html.className) || '') + ' ' +
                      ((body && body.className) || '');
        if (/\bsplunk-theme-light\b|\btheme-light\b|\blight-theme\b/.test(classes)) return 'light';
        if (/\bsplunk-theme-dark\b|\btheme-dark\b|\bdark-theme\b/.test(classes)) return 'dark';
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            var ref = body || html;
            if (ref) {
                var bg = window.getComputedStyle(ref).backgroundColor;
                var m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (m) {
                    var r = parseInt(m[1], 10);
                    var g = parseInt(m[2], 10);
                    var b = parseInt(m[3], 10);
                    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    return lum > 0.5 ? 'light' : 'dark';
                }
            }
        }
        return 'dark';
    }

    // ── Font loading ────────────────────────────────────────────

    var _fontReady = false;
    var _fontPending = false;
    var _fontCallbacks = [];

    function loadFont(onReady) {
        if (_fontReady) { onReady(); return; }
        _fontCallbacks.push(onReady);
        if (_fontPending) return;
        _fontPending = true;

        // Stagger callbacks across animation frames instead of firing all in
        // one tick. On the 256-icon showcase, slamming 256 _render() calls
        // back-to-back when the font resolves freezes the main thread for
        // a noticeable beat. Spreading them lets the browser paint and stay
        // responsive while panels fill in.
        function notifyAll() {
            _fontReady = true;
            var cbs = _fontCallbacks;
            _fontCallbacks = [];
            var BATCH = 8; // panels per frame
            var raf = (typeof requestAnimationFrame === 'function')
                ? requestAnimationFrame
                : function(f) { setTimeout(f, 16); };
            function drain(i) {
                var end = Math.min(i + BATCH, cbs.length);
                for (var j = i; j < end; j++) {
                    try { cbs[j](); } catch (e) { /* keep draining */ }
                }
                if (end < cbs.length) raf(function() { drain(end); });
            }
            drain(0);
        }

        if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
            setTimeout(notifyAll, 200);
            return;
        }

        document.fonts.load('400 48px "Material Symbols Outlined"').then(notifyAll);

        // Safety timeout — render after 2s even if promise stalls
        setTimeout(function() {
            if (!_fontReady) notifyAll();
        }, 2000);
    }

    // ── Background shape helpers ────────────────────────────────

    function drawCircleBg(ctx, cx, cy, radius) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
    }

    function drawRoundedRectBg(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function drawSquareBg(ctx, x, y, w, h) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.closePath();
    }

    // ── Main visualization ──────────────────────────────────────

    return SplunkVisualizationBase.extend({

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            if (this.el) this.el.classList.add('icon-library-viz');
            this._lastConfig = null;
            this._lastData = null;
            this._canvas = null;
            this._reflowTimer = null;
            this._drilldownEnabled = false;
            this._resolvedIcon = 'home';
            this._resolvedLabel = '';
            this._resolvedColor = '#06B6D4';
            this._fontDone = false;
            this._resolvedField = 'icon';
            this._clickHandler = null;
            this._pulseRaf = null;
            this._pulseActive = false;
            this._pulsePhase = 0;
            this._pulseStartTime = 0;
            this._pulseSpeed = 1;
            this._resolvedValue = NaN;
            this._tooltipMode = 'no';
            this._tooltip = null;
            this._mouseEnterHandler = null;
            this._mouseMoveHandler = null;
            this._mouseLeaveHandler = null;
            if (this.el) {
                this._canvas = document.createElement('canvas');
                this._canvas.style.width = '100%';
                this._canvas.style.height = '100%';
                this._canvas.style.display = 'block';
                this.el.appendChild(this._canvas);
                this._setupNoDataObserver();
                this._setupClickHandler();
                this._setupTooltip();
            }
        },

        _setupNoDataObserver: function() {
            // Hides Splunk's "no results" overlay so the icon viz can render
            // without data attached. Narrowed scope (childList only, no subtree)
            // since Splunk injects the placeholder as a direct child of this.el.
            // Self-disconnects after the first successful render to avoid running
            // 256 observers indefinitely on the showcase dashboard.
            if (typeof MutationObserver === 'undefined' || !this.el) return;
            var self = this;
            this._placeholderObs = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                        var node = mutations[i].addedNodes[j];
                        if (node.nodeType !== 1) continue;
                        if (node.classList && (
                            node.classList.contains('viz-empty-placeholder') ||
                            node.classList.contains('splunk-no-results-message'))) {
                            node.style.display = 'none';
                        }
                    }
                }
            });
            this._placeholderObs.observe(this.el, { childList: true, subtree: false });
        },

        _disconnectPlaceholderObs: function() {
            if (this._placeholderObs) {
                this._placeholderObs.disconnect();
                this._placeholderObs = null;
            }
        },

        _setupClickHandler: function() {
            var self = this;
            this._clickHandler = function(event) {
                // Always fire the FIELD_VALUE_DRILLDOWN event. Splunk Studio
                // silently drops it when no eventHandler is wired — there's no
                // downside to dispatching, and trying to detect "is something
                // wired?" from inside the viz is unreliable since panel options
                // aren't consistently passed through to the viz config.
                //
                // Payload uses literal {<fieldName>: <fieldValue>} pairs so that
                // setToken handlers can reference them with key: "<fieldName>".
                // The {name, value} shape from Splunk's older docs does NOT work
                // here: Studio doesn't expose those as click.value / click.name
                // for custom-viz FIELD_VALUE_DRILLDOWN payloads. Empirically,
                // key: "value" against {name, value} resolves to data.name (the
                // literal string "icon"), not data.value.
                event.preventDefault();
                try {
                    var fieldName = self._resolvedField || 'icon';
                    var payload = {};
                    payload[fieldName] = self._resolvedIcon || '';
                    // Include label and color so users with multi-token setToken
                    // handlers can capture all three values from one click.
                    if (self._resolvedLabel) payload.label = self._resolvedLabel;
                    if (self._resolvedColor) payload.color = self._resolvedColor;
                    self.drilldown({
                        action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                        data: payload
                    }, event);
                } catch (e) { /* harness or missing handler */ }
            };
            this.el.addEventListener('click', this._clickHandler);
        },

        _setupTooltip: function() {
            if (!this.el || typeof document === 'undefined') return;
            var self = this;
            var tip = document.createElement('div');
            tip.className = 'icon-library-tooltip';
            tip.setAttribute('style',
                'position:fixed;' +
                'pointer-events:none;' +
                'background:rgba(15,23,42,0.95);' +
                'color:#F1F5F9;' +
                'padding:6px 10px;' +
                'border-radius:6px;' +
                'font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;' +
                'white-space:nowrap;' +
                'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
                'z-index:2147483647;' +
                'display:none;'
            );
            document.body.appendChild(tip);
            this._tooltip = tip;

            this._mouseEnterHandler = function(ev) {
                if (!self._tooltipShouldShow()) return;
                var txt = self._tooltipText();
                if (!txt) return;
                tip.textContent = txt;
                tip.style.display = 'block';
                self._positionTooltip(ev);
            };
            this._mouseMoveHandler = function(ev) {
                if (tip.style.display !== 'block') return;
                self._positionTooltip(ev);
            };
            this._mouseLeaveHandler = function() {
                tip.style.display = 'none';
            };
            this.el.addEventListener('mouseenter', this._mouseEnterHandler);
            this.el.addEventListener('mousemove', this._mouseMoveHandler);
            this.el.addEventListener('mouseleave', this._mouseLeaveHandler);
        },

        _positionTooltip: function(ev) {
            if (!this._tooltip) return;
            var x = ev.clientX + 14;
            var y = ev.clientY + 14;
            var tw = this._tooltip.offsetWidth;
            var th = this._tooltip.offsetHeight;
            if (typeof window !== 'undefined') {
                if (x + tw > window.innerWidth)  x = ev.clientX - tw - 14;
                if (y + th > window.innerHeight) y = ev.clientY - th - 14;
                if (x < 0) x = 0;
                if (y < 0) y = 0;
            }
            this._tooltip.style.left = x + 'px';
            this._tooltip.style.top  = y + 'px';
        },

        _tooltipShouldShow: function() {
            if (this._tooltipMode === 'no')  return false;
            if (this._tooltipMode === 'yes') return true;
            // 'auto': show only when there's meaningful runtime context to display —
            // a SPL-driven label or a threshold value. A static decoration panel
            // (icon name only, no data) won't get a tooltip.
            if (this._resolvedLabel) return true;
            if (typeof this._resolvedValue === 'number' && !isNaN(this._resolvedValue)) return true;
            return false;
        },

        _tooltipText: function() {
            var parts = [];
            if (this._resolvedLabel) parts.push(this._resolvedLabel);
            if (this._resolvedIcon)  parts.push(this._resolvedIcon);
            if (typeof this._resolvedValue === 'number' && !isNaN(this._resolvedValue)) {
                parts.push(String(this._resolvedValue));
            }
            return parts.join(' · ');
        },

        getInitialDataParams: function() {
            // The viz only ever reads data.rows[0] — request a single row instead
            // of the default 10k. On dashboards with many icon panels (e.g. the
            // 256-icon showcase) this avoids transferring ~2.5M unused rows.
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 1
            };
        },

        formatData: function(data) {
            return data;
        },

        updateView: function(data, config) {
            // Splunk re-invokes updateView on a wide variety of events (panel
            // resize, dashboard refresh, neighbor-panel updates). When the actual
            // inputs haven't changed, skip the full canvas redraw. Cheap identity
            // check — Splunk hands us the same object reference when nothing changed.
            if (config === this._lastConfig && data === this._lastData && this._fontDone) {
                return;
            }
            this._lastConfig = config;
            this._lastData = data;
            var self = this;
            if (!this._fontDone) {
                // Render once with the browser's fallback font right away so the
                // panel has SOMETHING visible during font load. Then re-render
                // with Material Symbols once the font resolves. Eliminates the
                // 0–2 second blank period on slow Docker installs.
                this._render(data, config);
                loadFont(function() {
                    self._fontDone = true;
                    self._render(data, config);
                });
            } else {
                this._render(data, config);
            }
        },

        reflow: function() {
            if (!this._lastConfig) return;
            var self = this;
            if (this._reflowTimer) return;
            this._reflowTimer = setTimeout(function() {
                self._reflowTimer = null;
                self._render(self._lastData, self._lastConfig);
            }, 16);
        },

        _startPulse: function() {
            if (this._pulseRaf) return;
            if (typeof requestAnimationFrame === 'undefined') return;
            var self = this;
            self._pulseStartTime = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
            function tick(now) {
                if (!self._pulseActive) {
                    self._pulseRaf = null;
                    return;
                }
                var t = (typeof now === 'number') ? now : (
                    (typeof performance !== 'undefined' && performance.now)
                        ? performance.now() : Date.now()
                );
                var elapsed = (t - self._pulseStartTime) / 1000;
                self._pulsePhase = (elapsed * self._pulseSpeed) % 1;
                if (self._lastConfig) {
                    self._render(self._lastData, self._lastConfig);
                }
                self._pulseRaf = requestAnimationFrame(tick);
            }
            self._pulseRaf = requestAnimationFrame(tick);
        },

        destroy: function() {
            if (this._reflowTimer) {
                clearTimeout(this._reflowTimer);
                this._reflowTimer = null;
            }
            this._disconnectPlaceholderObs();
            if (this._clickHandler && this.el) {
                this.el.removeEventListener('click', this._clickHandler);
            }
            this._clickHandler = null;
            if (this.el) {
                if (this._mouseEnterHandler) this.el.removeEventListener('mouseenter', this._mouseEnterHandler);
                if (this._mouseMoveHandler)  this.el.removeEventListener('mousemove',  this._mouseMoveHandler);
                if (this._mouseLeaveHandler) this.el.removeEventListener('mouseleave', this._mouseLeaveHandler);
            }
            this._mouseEnterHandler = null;
            this._mouseMoveHandler  = null;
            this._mouseLeaveHandler = null;
            if (this._tooltip && this._tooltip.parentNode) {
                this._tooltip.parentNode.removeChild(this._tooltip);
            }
            this._tooltip = null;
            this._pulseActive = false;
            if (this._pulseRaf && typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(this._pulseRaf);
            }
            this._pulseRaf = null;
            this._canvas = null;
            this._lastConfig = null;
            this._lastData = null;
            SplunkVisualizationBase.prototype.destroy.apply(this, arguments);
        },

        _render: function(data, config) {
            if (!config) config = {};
            var ns = getNS(this);
            var el = this.el;
            if (!el) return;
            var w = el.offsetWidth;
            var h = el.offsetHeight;
            if (w <= 0 || h <= 0) return;

            // Cap devicePixelRatio at 2. On 4K/5K/HiDPI displays dpr can be 3+,
            // which quadruples the canvas backing buffer. For 256 panels at 120px
            // each that's ~130MB of canvas memory — clamping to 2 still looks
            // crisp on Retina and roughly halves allocation on extreme displays.
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var canvas = this._canvas;
            if (!canvas) return;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            var ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);

            // ── Read config ──────────────────────────────────────
            var iconName    = getOption(config, ns, 'iconName', 'home');
            var customIcon  = getOption(config, ns, 'customIcon', '');
            var iconColor   = getOption(config, ns, 'iconColor', '#06B6D4');
            var iconSize    = parseInt(getOption(config, ns, 'iconSize', '0'), 10);
            var hAlign      = getOption(config, ns, 'hAlign', 'center');
            var vAlign      = getOption(config, ns, 'vAlign', 'center');
            var bgShape     = getOption(config, ns, 'bgShape', 'none');
            var bgColor     = getOption(config, ns, 'bgColor', '#1E293B');
            var bgOpacity   = parseFloat(getOption(config, ns, 'bgOpacity', '1'));
            var bgPadding   = parseInt(getOption(config, ns, 'bgPadding', '16'), 10);
            var bgRadius    = parseInt(getOption(config, ns, 'bgRadius', '12'), 10);
            var showLabel   = getOption(config, ns, 'showLabel', 'no');
            var labelText   = getOption(config, ns, 'labelText', '');
            var labelColor  = getOption(config, ns, 'labelColor', '#94A3B8');
            var labelSize   = parseInt(getOption(config, ns, 'labelSize', '0'), 10);
            var shadowOn    = getOption(config, ns, 'shadow', 'no');
            var shadowColor = getOption(config, ns, 'shadowColor', '#000000');
            var shadowBlur  = parseInt(getOption(config, ns, 'shadowBlur', '8'), 10);
            var shadowX     = parseInt(getOption(config, ns, 'shadowOffsetX', '0'), 10);
            var shadowY     = parseInt(getOption(config, ns, 'shadowOffsetY', '4'), 10);
            var glowOn      = getOption(config, ns, 'glow', 'no');
            var glowColor   = getOption(config, ns, 'glowColor', '#06B6D4');
            var glowSize    = parseInt(getOption(config, ns, 'glowSize', '12'), 10);
            var rotation    = parseInt(getOption(config, ns, 'rotation', '0'), 10);

            // Drilldown affordance is shown when EITHER:
            //   1. The panel options include "drilldown": "all" (Studio signal that
            //      an eventHandler is wired), OR
            //   2. A search is attached and returns at least one row (proxy for
            //      "this panel is intended to be interactive").
            // Splunk Studio sometimes strips panel-level options before passing
            // config to custom vizs, so condition 1 alone is not reliable — the
            // data-attachment fallback covers that case.
            // The click handler always fires this.drilldown() — Studio silently
            // drops the event if no eventHandler is wired, so this is always safe.
            var panelDrilldown = config['drilldown'];
            var panelDrilldownOn = (panelDrilldown && panelDrilldown !== 'none' && panelDrilldown !== 'no');
            var dataAttached = !!(data && data.rows && data.rows.length > 0);

            // Threshold colors — RAG model with two breakpoints + three bands.
            // DOS-driven option values (rangeValue/matchValue/gradient) flow through
            // the static formatter pickers above; this block layers an extra rule
            // on top when the user opts in.
            var thrField = getOption(config, ns, 'thresholdField', 'value');
            var thrLow   = parseFloat(getOption(config, ns, 'thresholdLow', '50'));
            var thrHigh  = parseFloat(getOption(config, ns, 'thresholdHigh', '90'));
            var thrDir   = getOption(config, ns, 'thresholdDirection', 'high_good');
            var thrColorLow  = getOption(config, ns, 'thresholdColorLow',  '#EF4444');
            var thrColorMid  = getOption(config, ns, 'thresholdColorMid',  '#F59E0B');
            var thrColorHigh = getOption(config, ns, 'thresholdColorHigh', '#22C55E');
            var colorIcon  = getOption(config, ns, 'colorIcon',  'yes') === 'yes';
            var colorLabel = getOption(config, ns, 'colorLabel', 'no')  === 'yes';
            var colorGlow  = getOption(config, ns, 'colorGlow',  'no')  === 'yes';
            var colorBg    = getOption(config, ns, 'colorBg',    'no')  === 'yes';

            // Threshold per-band effects — icon swap, glow scaling, pulse animation
            var thrIconLow  = getOption(config, ns, 'thresholdIconLow',  '');
            var thrIconMid  = getOption(config, ns, 'thresholdIconMid',  '');
            var thrIconHigh = getOption(config, ns, 'thresholdIconHigh', '');
            var thrGlowScaleLow  = parseFloat(getOption(config, ns, 'thresholdGlowScaleLow',  '1'));
            var thrGlowScaleMid  = parseFloat(getOption(config, ns, 'thresholdGlowScaleMid',  '1'));
            var thrGlowScaleHigh = parseFloat(getOption(config, ns, 'thresholdGlowScaleHigh', '1'));
            var thrPulse = getOption(config, ns, 'thresholdPulse', 'no');
            var thrPulseSpeed = parseFloat(getOption(config, ns, 'thresholdPulseSpeed', '1'));
            if (isNaN(thrPulseSpeed) || thrPulseSpeed <= 0) thrPulseSpeed = 1;

            // ── Theme + tooltip behaviour ────────────────────────
            var themeOpt = getOption(config, ns, 'theme', 'auto');
            var theme = (themeOpt === 'dark' || themeOpt === 'light')
                ? themeOpt
                : detectTheme();
            // Light-theme adjustments only fire when the user hasn't moved off
            // the factory defaults — preserves explicit customisation. The
            // threshold engine below can still override these when its
            // colorLabel/colorBg toggles are on.
            if (theme === 'light') {
                if (labelColor === '#94A3B8') labelColor = '#475569';
                if (bgColor    === '#1E293B') bgColor    = '#E2E8F0';
                if (shadowColor === '#000000') shadowColor = '#475569';
            }

            this._tooltipMode = getOption(config, ns, 'tooltip', 'auto');

            this._drilldownEnabled = panelDrilldownOn || dataAttached;

            // Sanitise and resolve icon name
            var resolvedIcon;
            var sanitized = sanitizeIconName(customIcon);
            if (sanitized !== '') {
                resolvedIcon = sanitized;
            } else {
                resolvedIcon = sanitizeIconName(iconName) || 'home';
            }

            // ── Data-driven overrides ────────────────────────────
            var resolvedField = 'icon';
            var thrNumeric = NaN;
            var sawColorColumn = false;
            if (data && data.rows && data.rows.length > 0 && data.fields) {
                var row = data.rows[0];
                var fields = data.fields;
                for (var fi = 0; fi < fields.length; fi++) {
                    var fname = fields[fi].name;
                    var fval = row[fi];
                    if (fval === null || fval === undefined) continue;
                    if (fname === 'icon') {
                        resolvedIcon = sanitizeIconName(String(fval)) || resolvedIcon;
                        resolvedField = 'icon';
                    }
                    if (fname === 'color') { iconColor = String(fval); sawColorColumn = true; }
                    if (fname === 'label') { labelText = String(fval); showLabel = 'yes'; }
                    if (fname === thrField) {
                        var n = parseFloat(fval);
                        if (!isNaN(n)) thrNumeric = n;
                    }
                }
            }

            // ── Threshold engine ─────────────────────────────────
            // An explicit `color` SPL column always wins over the threshold rule —
            // it's the most specific signal the search can send. DOS expressions
            // bound to iconColor in the dashboard JSON already flow through the
            // static iconColor variable above, so they remain visible unless one
            // of the colorIcon/Label/Glow/Bg toggles overrides them.
            var thrBand = null;
            var thrBandIcon = '';
            var thrBandGlowScale = 1;
            var isCritical = false;
            var isWarn = false;
            if (!isNaN(thrNumeric)) {
                // bandIdx: 0 = low position on the scale, 1 = mid, 2 = high.
                var bandIdx;
                if (thrNumeric < thrLow)        bandIdx = 0;
                else if (thrNumeric < thrHigh)  bandIdx = 1;
                else                            bandIdx = 2;

                // For high_bad direction, swap low and high band colors/icons/scales
                // so the "low band on the scale" gets the high-band visual treatment.
                var bandColors = [thrColorLow, thrColorMid, thrColorHigh];
                var bandIcons  = [thrIconLow,  thrIconMid,  thrIconHigh];
                var bandGlows  = [thrGlowScaleLow, thrGlowScaleMid, thrGlowScaleHigh];
                if (thrDir === 'high_bad') {
                    bandColors = [thrColorHigh, thrColorMid, thrColorLow];
                    bandIcons  = [thrIconHigh,  thrIconMid,  thrIconLow];
                    bandGlows  = [thrGlowScaleHigh, thrGlowScaleMid, thrGlowScaleLow];
                }

                thrBand = bandColors[bandIdx];
                thrBandIcon = bandIcons[bandIdx];
                thrBandGlowScale = bandGlows[bandIdx];
                if (isNaN(thrBandGlowScale)) thrBandGlowScale = 1;

                // Map bandIdx to a semantic role independent of direction:
                //   high_good: low band (0) is bad, high band (2) is good
                //   high_bad:  low band (0) is good, high band (2) is bad
                if (thrDir === 'high_good') {
                    isCritical = (bandIdx === 0);
                } else {
                    isCritical = (bandIdx === 2);
                }
                isWarn = (bandIdx === 1);
            }

            if (thrBand !== null) {
                if (colorIcon && !sawColorColumn) iconColor  = thrBand;
                if (colorLabel)                   labelColor = thrBand;
                if (colorGlow)                    glowColor  = thrBand;
                if (colorBg)                      bgColor    = thrBand;

                // Icon swap per band — overrides resolvedIcon if non-empty.
                if (thrBandIcon) {
                    var swapped = sanitizeIconName(thrBandIcon);
                    if (swapped) resolvedIcon = swapped;
                }

                // Glow scale per band — multiplies the formatter glow size.
                if (thrBandGlowScale !== 1) {
                    glowSize = Math.max(0, Math.round(glowSize * thrBandGlowScale));
                }
            }

            // Pulse animation — modulates the glow radius when in the matching band.
            // The pulse loop runs via requestAnimationFrame; this block just decides
            // whether it should be running this frame.
            var wantsPulse =
                (thrPulse === 'critical' && isCritical) ||
                (thrPulse === 'warning' && isWarn) ||
                (thrPulse === 'critical_and_warning' && (isCritical || isWarn));
            if (wantsPulse && glowOn === 'yes') {
                // Apply phase modulation to glow size right before render.
                var pulseMod = 1 + 0.45 * Math.sin(2 * Math.PI * this._pulsePhase);
                glowSize = Math.max(1, Math.round(glowSize * pulseMod));
                this._pulseSpeed = thrPulseSpeed;
                if (!this._pulseActive) {
                    this._pulseActive = true;
                    this._startPulse();
                }
            } else {
                this._pulseActive = false;
                // The animation tick will see _pulseActive=false and self-terminate.
            }

            this._resolvedIcon = resolvedIcon;
            this._resolvedLabel = labelText;
            this._resolvedColor = iconColor;
            this._resolvedField = resolvedField;
            this._resolvedValue = thrNumeric;

            var cursorStyle = this._drilldownEnabled ? 'pointer' : '';
            el.style.cursor = cursorStyle;
            canvas.style.cursor = cursorStyle;

            // ── Calculate sizes ──────────────────────────────────
            var hasLabel = (showLabel === 'yes' && labelText && labelText.trim() !== '');
            var pad = Math.max(8, Math.min(w, h) * 0.04);

            var effectPad = 0;
            if (glowOn === 'yes') effectPad = Math.max(effectPad, glowSize);
            if (shadowOn === 'yes') effectPad = Math.max(effectPad, shadowBlur + Math.abs(shadowX) + Math.abs(shadowY));

            var availW = w - (pad + effectPad) * 2;
            var availH = h - (pad + effectPad) * 2;
            if (availW < 16) availW = 16;
            if (availH < 16) availH = 16;

            var computedIconSize;
            if (iconSize > 0) {
                computedIconSize = iconSize;
            } else if (bgShape !== 'none') {
                var maxBgDim = Math.min(availW, availH);
                var iconBudget = maxBgDim - bgPadding * 2;
                if (hasLabel) {
                    var estLabelH = Math.max(8, Math.min(20, Math.min(w, h) * 0.09)) + 6 + 8;
                    iconBudget = iconBudget - estLabelH;
                }
                computedIconSize = Math.max(16, iconBudget);
            } else {
                var sizeRef = Math.min(availW, availH);
                if (hasLabel) {
                    sizeRef = Math.min(availW, availH * 0.78);
                }
                computedIconSize = Math.max(16, sizeRef * 0.80);
            }

            var computedLabelSize;
            if (labelSize > 0) {
                computedLabelSize = labelSize;
            } else {
                computedLabelSize = Math.max(8, Math.min(20, Math.min(w, h) * 0.09));
            }

            var labelH = hasLabel ? (computedLabelSize + 6) : 0;
            var contentH = computedIconSize + (hasLabel ? 8 + labelH : 0);

            // ── Alignment ────────────────────────────────────────
            var cx, cy;

            if (hAlign === 'left') {
                cx = pad + effectPad + computedIconSize / 2;
            } else if (hAlign === 'right') {
                cx = w - pad - effectPad - computedIconSize / 2;
            } else {
                cx = w / 2;
            }

            if (vAlign === 'top') {
                cy = pad + effectPad + computedIconSize / 2;
            } else if (vAlign === 'bottom') {
                cy = h - pad - effectPad - labelH - (hasLabel ? 8 : 0) - computedIconSize / 2;
            } else {
                var blockTop = (h - contentH) / 2;
                cy = blockTop + computedIconSize / 2;
            }

            // ── Clear ────────────────────────────────────────────
            ctx.clearRect(0, 0, w, h);

            // ── Draw background shape ────────────────────────────
            if (bgShape !== 'none') {
                ctx.save();

                var bgW = computedIconSize + bgPadding * 2;
                var bgH = contentH + bgPadding * 2;
                var bgDiameter = Math.max(bgW, bgH);

                var bgCx = cx;
                var bgCy = cy + (contentH - computedIconSize) / 2;

                if (rotation !== 0) {
                    ctx.translate(bgCx, bgCy);
                    ctx.rotate(rotation * Math.PI / 180);
                    ctx.translate(-bgCx, -bgCy);
                }

                ctx.globalAlpha = bgOpacity;

                if (shadowOn === 'yes') {
                    ctx.shadowColor = hexToRgba(shadowColor, 0.5);
                    ctx.shadowBlur = shadowBlur;
                    ctx.shadowOffsetX = shadowX;
                    ctx.shadowOffsetY = shadowY;
                }

                ctx.fillStyle = bgColor;

                if (bgShape === 'circle') {
                    drawCircleBg(ctx, bgCx, bgCy, bgDiameter / 2);
                    ctx.fill();
                } else if (bgShape === 'rounded_rect') {
                    drawRoundedRectBg(ctx, bgCx - bgW / 2, bgCy - bgH / 2, bgW, bgH, bgRadius);
                    ctx.fill();
                } else if (bgShape === 'square') {
                    drawSquareBg(ctx, bgCx - bgW / 2, bgCy - bgH / 2, bgW, bgH);
                    ctx.fill();
                }

                ctx.restore();
            }

            // ── Draw icon ────────────────────────────────────────
            ctx.save();

            if (rotation !== 0 && bgShape === 'none') {
                ctx.translate(cx, cy);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }

            if (glowOn === 'yes') {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = glowSize;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else if (shadowOn === 'yes' && bgShape === 'none') {
                ctx.shadowColor = hexToRgba(shadowColor, 0.5);
                ctx.shadowBlur = shadowBlur;
                ctx.shadowOffsetX = shadowX;
                ctx.shadowOffsetY = shadowY;
            }

            ctx.fillStyle = iconColor;
            ctx.font = '400 ' + Math.round(computedIconSize) + 'px "Material Symbols Outlined"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillText(resolvedIcon, cx, cy);

            ctx.restore();

            // ── Draw label ───────────────────────────────────────
            if (hasLabel) {
                ctx.save();
                ctx.fillStyle = labelColor;
                ctx.font = '400 ' + Math.round(computedLabelSize) + 'px "Inter", "Helvetica Neue", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                var labelY = cy + computedIconSize / 2 + 8;
                ctx.fillText(labelText, cx, labelY);
                ctx.restore();
            }

            // Successful render — Splunk has either not shown the no-results
            // overlay or we've already hidden it. The observer's job is done.
            this._disconnectPlaceholderObs();
        }
    });
});
