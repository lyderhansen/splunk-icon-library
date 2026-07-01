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

    // ── Value formatting (v1.7.0) ───────────────────────────────
    // Applied to the KPI value and, when trendFormat is 'absolute' or
    // 'both', to the trend delta as well.
    function formatNumber(n, mode) {
        if (isNaN(n)) return '';
        if (mode === 'integer')      return String(Math.round(n));
        if (mode === 'one_decimal')  return n.toFixed(1);
        if (mode === 'two_decimals') return n.toFixed(2);
        if (mode === 'thousands') {
            var parts = String(Math.round(n * 100) / 100).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.join('.');
        }
        if (mode === 'abbreviated') {
            var abs = Math.abs(n);
            var sign = n < 0 ? '-' : '';
            if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + 'T';
            if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B';
            if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1)  + 'M';
            if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1)  + 'K';
            return String(n);
        }
        return String(n); // raw
    }

    // Neutral text color for trend when the change is exactly zero.
    function INK_SOFT_FOR_THEME(theme) {
        return theme === 'light' ? '#6E6E73' : '#94A3B8';
    }

    // ── Glyph centroid offset ──────────────────────────────────
    // Material Symbols is a ligature-only font: the multi-character
    // run ("check_circle") is replaced with a single glyph at paint
    // time. Canvas's measureText reports the *un-ligated* advance
    // width, so textAlign='center' lands the glyph subtly off-centre.
    //
    // To get a reliable correction, render the icon once on an
    // offscreen canvas and scan the painted alpha channel for the
    // tightest non-transparent bounding box. The visible centroid of
    // that bbox minus the draw anchor is the centering delta.
    //
    // Cached by (icon, font-size); recomputation only happens when a
    // new icon or new size is used. Returns {dx, dy} (0,0 fallback if
    // the icon hasn't painted yet or the helper can't read pixels).
    var _glyphCentroidCache = {};

    function _getGlyphCentroidOffset(icon, fontSize) {
        var key = icon + '@' + fontSize;
        if (Object.prototype.hasOwnProperty.call(_glyphCentroidCache, key)) {
            return _glyphCentroidCache[key];
        }
        var fallback = { dx: 0, dy: 0 };
        try {
            var buf = Math.max(32, Math.round(fontSize * 1.6));
            var c = document.createElement('canvas');
            c.width = buf;
            c.height = buf;
            var mctx = c.getContext('2d');
            if (!mctx) return fallback;
            mctx.font = '400 ' + fontSize + 'px "Material Symbols Outlined"';
            mctx.textAlign = 'center';
            mctx.textBaseline = 'middle';
            mctx.fillStyle = '#000';
            mctx.fillText(icon, buf / 2, buf / 2);

            var img;
            try {
                img = mctx.getImageData(0, 0, buf, buf);
            } catch (e) {
                return fallback;
            }
            var data = img.data;
            var minX = buf, maxX = -1, minY = buf, maxY = -1;
            var x, y, i, alpha;
            for (y = 0; y < buf; y++) {
                for (x = 0; x < buf; x++) {
                    i = (y * buf + x) * 4 + 3;
                    alpha = data[i];
                    if (alpha > 8) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX < 0) {
                // Nothing painted — font likely not loaded yet. Don't
                // cache; let the next render retry.
                return fallback;
            }
            var anchor = buf / 2;
            var glyphCenterX = (minX + maxX) / 2;
            var glyphCenterY = (minY + maxY) / 2;
            var offset = {
                dx: anchor - glyphCenterX,
                dy: anchor - glyphCenterY
            };
            _glyphCentroidCache[key] = offset;
            return offset;
        } catch (e) {
            return fallback;
        }
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
            // Historic behaviour was count:1 (single-row search). v1.7.0 added
            // trend rendering which needs the last row plus one N-th-back row
            // for delta calculation. count:200 covers the common case (24h @
            // 5-min bins = 288 rows — trend still works via `head 200` upstream)
            // while keeping wire size reasonable. The showcase's 256 panels
            // request ~50k rows total — negligible compared with the framework
            // chunks that dominate that page.
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 200
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

            // ── Value display (v1.7.0) ───────────────────────────
            // Optional big-number KPI rendered alongside the icon. Reads the
            // numeric column named by valueField from the LAST row of the
            // returned series (timechart-style pattern).
            var showValue        = getOption(config, ns, 'showValue',         'no') === 'yes';
            var valueField       = getOption(config, ns, 'valueField',        'value');
            var valuePosition    = getOption(config, ns, 'valuePosition',     'right');
            var valueSize        = parseInt(getOption(config, ns, 'valueSize', '0'), 10);
            var valueColor       = getOption(config, ns, 'valueColor',        '#F1F5F9');
            var valuePrefix      = getOption(config, ns, 'valuePrefix',       '');
            var valueUnit        = getOption(config, ns, 'valueUnit',         '');
            var valueUnitPos     = getOption(config, ns, 'valueUnitPosition', 'after');
            var valueFormat      = getOption(config, ns, 'valueFormat',       'raw');
            var colorValue       = getOption(config, ns, 'colorValue',        'no') === 'yes';

            // ── Trend (v1.7.0) ───────────────────────────────────
            // Compares the latest row's valueField to a row N bins back and
            // renders an up/down arrow with the delta.
            var showTrend        = getOption(config, ns, 'showTrend',         'no') === 'yes';
            var trendCompareBack = parseInt(getOption(config, ns, 'trendCompareBack', '1'), 10);
            var trendDirection   = getOption(config, ns, 'trendDirection',    'up_good');
            var trendFormat      = getOption(config, ns, 'trendFormat',       'percentage');
            var trendCaption     = getOption(config, ns, 'trendCaption',      '');
            if (isNaN(trendCompareBack) || trendCompareBack < 1) trendCompareBack = 1;

            // ── Sparkline (v1.7.1) ───────────────────────────────
            var showSparkline    = getOption(config, ns, 'showSparkline',    'no') === 'yes';
            var sparklineColorRaw = getOption(config, ns, 'sparklineColor',  'auto');
            var sparklineStyle   = getOption(config, ns, 'sparklineStyle',   'line');
            var sparklineSplit   = getOption(config, ns, 'sparklineSplitAtCompare', 'yes') === 'yes';

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
            // Read the LAST row of the returned series (timechart pattern).
            // For a single-row search (| makeresults | eval …) the last row
            // is the only row, so behaviour is unchanged from earlier releases.
            var resolvedField = 'icon';
            var thrNumeric = NaN;
            var sawColorColumn = false;
            var currentValue = NaN;      // numeric value for the KPI display
            var compareValue = NaN;      // value from N bins back, for trend
            var valueFieldIdx = -1;      // index of the valueField column in data.fields
            var valueSeries = null;      // full series of numeric values for the sparkline
            if (data && data.rows && data.rows.length > 0 && data.fields) {
                var lastRow = data.rows[data.rows.length - 1];
                var fields = data.fields;
                for (var fi = 0; fi < fields.length; fi++) {
                    var fname = fields[fi].name;
                    var fval = lastRow[fi];
                    if (fname === valueField) valueFieldIdx = fi;
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
                    if (fname === valueField) {
                        var nv = parseFloat(fval);
                        if (!isNaN(nv)) currentValue = nv;
                    }
                }
                // Trend compare: N rows back from the last row.
                if (showTrend && valueFieldIdx >= 0) {
                    var compareIdx = data.rows.length - 1 - trendCompareBack;
                    if (compareIdx >= 0) {
                        var compareRow = data.rows[compareIdx];
                        var ncv = parseFloat(compareRow[valueFieldIdx]);
                        if (!isNaN(ncv)) compareValue = ncv;
                    }
                }
                // Sparkline: collect all rows of the valueField column.
                if (showSparkline && valueFieldIdx >= 0 && data.rows.length >= 2) {
                    valueSeries = [];
                    for (var ri = 0; ri < data.rows.length; ri++) {
                        var rv = parseFloat(data.rows[ri][valueFieldIdx]);
                        if (!isNaN(rv)) valueSeries.push(rv);
                    }
                    if (valueSeries.length < 2) valueSeries = null;
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
            var hasValue = (showValue && !isNaN(currentValue));
            var hasTrend = (showTrend && hasValue && !isNaN(compareValue) && compareValue !== 0);
            var hasSparkline = (showSparkline && hasValue && valueSeries !== null);
            var pad = Math.max(8, Math.min(w, h) * 0.04);

            var effectPad = 0;
            if (glowOn === 'yes') effectPad = Math.max(effectPad, glowSize);
            if (shadowOn === 'yes') effectPad = Math.max(effectPad, shadowBlur + Math.abs(shadowX) + Math.abs(shadowY));

            var availW = w - (pad + effectPad) * 2;
            var availH = h - (pad + effectPad) * 2;
            if (availW < 16) availW = 16;
            if (availH < 16) availH = 16;

            // ── Layout: icon area vs value area ──────────────────
            // Historic single-element behaviour reserved the whole canvas for
            // the icon. When Show Value is on we carve the canvas into two
            // regions per valuePosition. The icon-drawing pipeline below uses
            // iconAreaX/Y/W/H for its bounds; the value pipeline at the end of
            // this function uses valueAreaX/Y/W/H.
            var iconAreaX = pad + effectPad;
            var iconAreaY = pad + effectPad;
            var iconAreaW = availW;
            var iconAreaH = availH;
            var valueAreaX = 0, valueAreaY = 0, valueAreaW = 0, valueAreaH = 0;
            if (hasValue) {
                // Value gets ~55% of the split dimension; icon gets ~45%.
                // Anecdotally this reads best when the value is the loud
                // element and the icon is the accent.
                if (valuePosition === 'right') {
                    iconAreaW = availW * 0.42;
                    valueAreaX = iconAreaX + iconAreaW + Math.min(16, availW * 0.02);
                    valueAreaY = iconAreaY;
                    valueAreaW = (pad + effectPad + availW) - valueAreaX;
                    valueAreaH = availH;
                } else if (valuePosition === 'left') {
                    valueAreaX = iconAreaX;
                    valueAreaY = iconAreaY;
                    valueAreaW = availW * 0.55;
                    valueAreaH = availH;
                    iconAreaX = valueAreaX + valueAreaW + Math.min(16, availW * 0.02);
                    iconAreaW = (pad + effectPad + availW) - iconAreaX;
                } else if (valuePosition === 'below') {
                    iconAreaH = availH * 0.55;
                    valueAreaX = iconAreaX;
                    valueAreaY = iconAreaY + iconAreaH + Math.min(12, availH * 0.02);
                    valueAreaW = availW;
                    valueAreaH = (pad + effectPad + availH) - valueAreaY;
                } else { // above
                    valueAreaX = iconAreaX;
                    valueAreaY = iconAreaY;
                    valueAreaW = availW;
                    valueAreaH = availH * 0.42;
                    iconAreaY = valueAreaY + valueAreaH + Math.min(12, availH * 0.02);
                    iconAreaH = (pad + effectPad + availH) - iconAreaY;
                }
            }

            var computedIconSize;
            if (iconSize > 0) {
                computedIconSize = iconSize;
            } else if (bgShape !== 'none') {
                var maxBgDim = Math.min(iconAreaW, iconAreaH);
                var iconBudget = maxBgDim - bgPadding * 2;
                if (hasLabel) {
                    var estLabelH = Math.max(8, Math.min(20, Math.min(w, h) * 0.09)) + 6 + 8;
                    iconBudget = iconBudget - estLabelH;
                }
                computedIconSize = Math.max(16, iconBudget);
            } else {
                var sizeRef = Math.min(iconAreaW, iconAreaH);
                if (hasLabel) {
                    sizeRef = Math.min(iconAreaW, iconAreaH * 0.78);
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
            // Icon centres are computed within the icon area (which may be
            // narrower/shorter than the full canvas when Show Value is on).
            var cx, cy;

            if (hAlign === 'left') {
                cx = iconAreaX + computedIconSize / 2;
            } else if (hAlign === 'right') {
                cx = iconAreaX + iconAreaW - computedIconSize / 2;
            } else {
                cx = iconAreaX + iconAreaW / 2;
            }

            if (vAlign === 'top') {
                cy = iconAreaY + computedIconSize / 2;
            } else if (vAlign === 'bottom') {
                cy = iconAreaY + iconAreaH - labelH - (hasLabel ? 8 : 0) - computedIconSize / 2;
            } else {
                var blockTop = iconAreaY + (iconAreaH - contentH) / 2;
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
            var iconFontSize = Math.round(computedIconSize);
            ctx.font = '400 ' + iconFontSize + 'px "Material Symbols Outlined"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Material Symbols is a ligature-only font. The browser substitutes
            // the multi-character run ("check_circle") with a single glyph at
            // paint time. ctx.measureText() reports the *un-ligated* advance
            // width, so textAlign='center' draws the glyph subtly off-centre.
            //
            // Scan the actual painted pixels on a one-off offscreen canvas to
            // compute the visible glyph centroid relative to the draw anchor,
            // then offset the real draw point by that delta. Cached by
            // (icon, font-size) so subsequent renders are free.
            var glyphOffset = _getGlyphCentroidOffset(resolvedIcon, iconFontSize);

            ctx.fillText(resolvedIcon, cx + glyphOffset.dx, cy + glyphOffset.dy);

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

            // ── Draw value + trend (v1.7.0) ──────────────────────
            if (hasValue) {
                var resolvedValueColor = valueColor;
                if (colorValue && thrBand !== null) resolvedValueColor = thrBand;
                if (theme === 'light' && valueColor === '#F1F5F9') resolvedValueColor = colorValue && thrBand !== null ? thrBand : '#1D1D1F';

                // Build the value string with prefix/unit/format.
                var displayed = formatNumber(currentValue, valueFormat);
                var valueStr;
                if (valueUnit) {
                    if (valueUnitPos === 'before') valueStr = valuePrefix + valueUnit + ' ' + displayed;
                    else                          valueStr = valuePrefix + displayed + ' ' + valueUnit;
                } else {
                    valueStr = valuePrefix + displayed;
                }

                // Auto-size the value font to fit valueArea. Reserve height at
                // the bottom for trend text (if any) and sparkline (if any).
                var trendReserveH    = hasTrend     ? valueAreaH * 0.22 : 0;
                var sparklineReserveH = hasSparkline ? valueAreaH * 0.28 : 0;
                var reservedBottomH  = trendReserveH + sparklineReserveH;
                var mainValueAreaH   = valueAreaH - reservedBottomH;
                var vFontSize;
                if (valueSize > 0) {
                    vFontSize = valueSize;
                } else {
                    // Fit-by-width and fit-by-height, take the smaller.
                    var maxByHeight = mainValueAreaH * 0.85;
                    ctx.save();
                    ctx.font = '600 100px "Inter", "Helvetica Neue", Arial, sans-serif';
                    var mw = ctx.measureText(valueStr).width;
                    ctx.restore();
                    // mw is width at 100px; scale to fit valueAreaW * 0.94.
                    var maxByWidth = mw > 0 ? (valueAreaW * 0.94 * 100 / mw) : maxByHeight;
                    vFontSize = Math.max(12, Math.min(maxByHeight, maxByWidth));
                }

                ctx.save();
                ctx.fillStyle = resolvedValueColor;
                ctx.font = '600 ' + Math.round(vFontSize) + 'px "Inter", "Helvetica Neue", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var valueCx = valueAreaX + valueAreaW / 2;
                var valueCy = valueAreaY + mainValueAreaH / 2;
                ctx.fillText(valueStr, valueCx, valueCy);
                ctx.restore();

                // Trend arrow + delta + optional caption.
                if (hasTrend) {
                    var delta = currentValue - compareValue;
                    var pct = (delta / Math.abs(compareValue)) * 100;
                    var arrow, isRising = delta > 0, isFlat = Math.abs(delta) < 1e-9;
                    if (isFlat) arrow = '→';
                    else        arrow = isRising ? '↑' : '↓';

                    var trendGood;
                    if (isFlat) trendGood = null;
                    else if (trendDirection === 'up_good') trendGood = isRising;
                    else                                   trendGood = !isRising;

                    var trendColor;
                    if (trendGood === null)      trendColor = INK_SOFT_FOR_THEME(theme);
                    else if (trendGood)          trendColor = '#22C55E';
                    else                         trendColor = '#EF4444';

                    var deltaAbs = Math.abs(delta);
                    var pctAbs = Math.abs(pct);
                    var deltaText;
                    if (trendFormat === 'absolute')      deltaText = formatNumber(deltaAbs, valueFormat);
                    else if (trendFormat === 'both')     deltaText = formatNumber(deltaAbs, valueFormat) + ' · ' + pctAbs.toFixed(1) + '%';
                    else                                 deltaText = pctAbs.toFixed(1) + '%';

                    var trendStr = arrow + ' ' + deltaText + (trendCaption ? ('  ' + trendCaption) : '');
                    var tFontSize = Math.max(10, Math.min(vFontSize * 0.34, trendReserveH * 0.7));
                    ctx.save();
                    ctx.fillStyle = trendColor;
                    ctx.font = '500 ' + Math.round(tFontSize) + 'px "Inter", "Helvetica Neue", Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    var trendY = valueAreaY + mainValueAreaH + trendReserveH / 2;
                    ctx.fillText(trendStr, valueCx, trendY);
                    ctx.restore();
                }

                // Sparkline: tiny polyline through the value series, drawn
                // in the reserved area at the very bottom of the value area.
                // When Show Trend is on and Split at compare point is on, the
                // sparkline is split-coloured: historical portion in a neutral
                // base color, recent portion (from compare-back index to now)
                // in the trend color. A subtle vertical marker at the split X
                // shows viewers where the comparison anchor sits on the
                // timeline.
                if (hasSparkline) {
                    // Base color (historical portion, and full sparkline when
                    // no split). Priority: explicit → threshold-band → soft ink.
                    var baseColor;
                    if (sparklineColorRaw && sparklineColorRaw !== 'auto') {
                        baseColor = sparklineColorRaw;
                    } else if (colorValue && thrBand !== null) {
                        baseColor = thrBand;
                    } else if (hasTrend && !sparklineSplit && typeof trendColor === 'string') {
                        // Single-color mode: whole sparkline inherits trend color.
                        baseColor = trendColor;
                    } else {
                        baseColor = INK_SOFT_FOR_THEME(theme);
                    }
                    // Recent-portion color (only used when splitting).
                    var recentColor = (hasTrend && typeof trendColor === 'string')
                        ? trendColor
                        : baseColor;

                    var sparkX = valueAreaX + valueAreaW * 0.04;
                    var sparkW = valueAreaW * 0.92;
                    var sparkY = valueAreaY + mainValueAreaH + trendReserveH;
                    var sparkH = sparklineReserveH * 0.85;

                    // Find min/max of the series to normalise.
                    var sMin = valueSeries[0], sMax = valueSeries[0];
                    for (var si = 1; si < valueSeries.length; si++) {
                        if (valueSeries[si] < sMin) sMin = valueSeries[si];
                        if (valueSeries[si] > sMax) sMax = valueSeries[si];
                    }
                    var sRange = sMax - sMin;
                    if (sRange < 1e-9) sRange = 1; // flat line
                    var padTopBot = sparkH * 0.08;
                    var innerH = sparkH - padTopBot * 2;

                    var n = valueSeries.length;
                    // Split index: everything up to and including splitIdx is
                    // "historical" (base color); everything from splitIdx to
                    // end is "recent" (trend color). Note the two segments
                    // overlap at splitIdx so the polyline connects cleanly.
                    var doSplit = (hasTrend && sparklineSplit && n > trendCompareBack + 1);
                    var splitIdx = n - 1 - trendCompareBack;
                    if (splitIdx < 1) splitIdx = 1;
                    if (splitIdx > n - 2) splitIdx = n - 2;

                    // Helper: build a point at index i.
                    var _pt = function(i) {
                        var px = sparkX + (n === 1 ? sparkW / 2 : (i / (n - 1)) * sparkW);
                        var norm = (valueSeries[i] - sMin) / sRange;
                        var py = sparkY + padTopBot + (1 - norm) * innerH;
                        return [px, py];
                    };

                    var strokeW = Math.max(1, Math.round(sparkH / 22));

                    ctx.save();
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';

                    // Area fill first (under the line), separately for each
                    // segment so the split colour also applies to the fill.
                    if (sparklineStyle === 'area') {
                        var baseY = sparkY + sparkH;
                        var drawAreaSeg = function(startI, endI, color) {
                            ctx.beginPath();
                            var p0 = _pt(startI);
                            ctx.moveTo(p0[0], p0[1]);
                            for (var ai = startI + 1; ai <= endI; ai++) {
                                var pa = _pt(ai);
                                ctx.lineTo(pa[0], pa[1]);
                            }
                            var pEnd = _pt(endI);
                            ctx.lineTo(pEnd[0], baseY);
                            ctx.lineTo(p0[0],   baseY);
                            ctx.closePath();
                            ctx.globalAlpha = 0.18;
                            ctx.fillStyle = color;
                            ctx.fill();
                        };
                        if (doSplit) {
                            drawAreaSeg(0,        splitIdx, baseColor);
                            drawAreaSeg(splitIdx, n - 1,    recentColor);
                        } else {
                            drawAreaSeg(0, n - 1, baseColor);
                        }
                        ctx.globalAlpha = 1;
                    }

                    // Line strokes.
                    var drawLineSeg = function(startI, endI, color) {
                        ctx.strokeStyle = color;
                        ctx.lineWidth = strokeW;
                        ctx.beginPath();
                        var p = _pt(startI);
                        ctx.moveTo(p[0], p[1]);
                        for (var li = startI + 1; li <= endI; li++) {
                            var pl = _pt(li);
                            ctx.lineTo(pl[0], pl[1]);
                        }
                        ctx.stroke();
                    };
                    if (doSplit) {
                        drawLineSeg(0,        splitIdx, baseColor);
                        drawLineSeg(splitIdx, n - 1,    recentColor);

                        // Vertical marker at the split point — a thin
                        // semi-transparent line spanning the sparkline area,
                        // plus a small filled circle where it crosses the
                        // polyline. Draws AFTER the line so it sits on top.
                        var splitPt = _pt(splitIdx);
                        ctx.strokeStyle = INK_SOFT_FOR_THEME(theme);
                        ctx.globalAlpha = 0.4;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(splitPt[0], sparkY);
                        ctx.lineTo(splitPt[0], sparkY + sparkH);
                        ctx.stroke();
                        ctx.globalAlpha = 1;

                        // Anchor dot at the split point.
                        ctx.fillStyle = baseColor;
                        ctx.beginPath();
                        ctx.arc(splitPt[0], splitPt[1], strokeW * 1.6, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        drawLineSeg(0, n - 1, baseColor);
                    }

                    ctx.restore();
                }
            }

            // Successful render — Splunk has either not shown the no-results
            // overlay or we've already hidden it. The observer's job is done.
            this._disconnectPlaceholderObs();
        }
    });
});
