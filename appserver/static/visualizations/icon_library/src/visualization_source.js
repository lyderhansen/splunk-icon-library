/*
 * Icon Library — Splunk Custom Visualization
 *
 * Renders Material Symbols icons on a Canvas with configurable color,
 * size, background shape, shadow, glow, label, and data-driven styling.
 * Supports click drilldown (native Splunk + URL).
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

    // ── Font loading ────────────────────────────────────────────

    var _fontReady = false;
    var _fontPending = false;
    var _fontCallbacks = [];

    function loadFont(onReady) {
        if (_fontReady) { onReady(); return; }
        _fontCallbacks.push(onReady);
        if (_fontPending) return;
        _fontPending = true;

        function notifyAll() {
            _fontReady = true;
            var cbs = _fontCallbacks;
            _fontCallbacks = [];
            for (var i = 0; i < cbs.length; i++) cbs[i]();
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
            this._drilldownUrl = '';
            this._drilldownNewTab = true;
            this._resolvedIcon = 'home';
            this._resolvedLabel = '';
            this._resolvedColor = '#06B6D4';
            this._fontDone = false;
            if (this.el) {
                this._canvas = document.createElement('canvas');
                this._canvas.style.width = '100%';
                this._canvas.style.height = '100%';
                this._canvas.style.display = 'block';
                this.el.appendChild(this._canvas);
                this._setupNoDataObserver();
                this._setupClickHandler();
            }
        },

        _setupNoDataObserver: function() {
            if (typeof MutationObserver !== 'undefined' && this.el) {
                this._placeholderObs = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                            var node = mutations[i].addedNodes[j];
                            if (node.nodeType === 1) {
                                var msg = node.querySelector
                                    ? node.querySelector('.viz-empty-placeholder, .splunk-no-results-message, [data-test="no-results"]')
                                    : null;
                                if (msg) msg.style.display = 'none';
                                if (node.classList &&
                                    (node.classList.contains('viz-empty-placeholder') ||
                                     node.classList.contains('splunk-no-results-message'))) {
                                    node.style.display = 'none';
                                }
                            }
                        }
                    }
                });
                this._placeholderObs.observe(this.el, { childList: true, subtree: true });
            }
        },

        _setupClickHandler: function() {
            var self = this;
            this.el.addEventListener('click', function(event) {
                if (!self._drilldownEnabled) return;

                var url = self._drilldownUrl;
                if (url) {
                    url = url.replace(/\$icon\$/g, self._resolvedIcon || '');
                    url = url.replace(/\$label\$/g, self._resolvedLabel || '');
                    url = url.replace(/\$color\$/g, encodeURIComponent(self._resolvedColor || ''));
                    if (self._drilldownNewTab) {
                        window.open(url, '_blank');
                    } else {
                        window.location.href = url;
                    }
                    return;
                }

                var drilldownData = {};
                drilldownData['icon'] = self._resolvedIcon || '';
                drilldownData['label'] = self._resolvedLabel || '';
                drilldownData['color'] = self._resolvedColor || '';
                event.preventDefault();
                try {
                    self.drilldown({
                        action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                        data: drilldownData
                    }, event);
                } catch (e) { /* harness or missing handler */ }
            });
        },

        getInitialDataParams: function() {
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            };
        },

        formatData: function(data) {
            return data;
        },

        updateView: function(data, config) {
            this._lastConfig = config;
            this._lastData = data;
            var self = this;
            if (!this._fontDone) {
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

        destroy: function() {
            if (this._reflowTimer) {
                clearTimeout(this._reflowTimer);
                this._reflowTimer = null;
            }
            if (this._placeholderObs) {
                this._placeholderObs.disconnect();
                this._placeholderObs = null;
            }
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

            var dpr = window.devicePixelRatio || 1;
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

            var drilldownOn  = getOption(config, ns, 'drilldown', 'no');
            var drilldownUrl = getOption(config, ns, 'drilldownUrl', '');
            var drilldownNewTab = getOption(config, ns, 'drilldownNewTab', 'yes') === 'yes';

            this._drilldownEnabled = (drilldownOn === 'yes') || (drilldownUrl !== '');
            this._drilldownUrl = drilldownUrl;
            this._drilldownNewTab = drilldownNewTab;

            // Sanitise and resolve icon name
            var resolvedIcon;
            var sanitized = sanitizeIconName(customIcon);
            if (sanitized !== '') {
                resolvedIcon = sanitized;
            } else {
                resolvedIcon = sanitizeIconName(iconName) || 'home';
            }

            // ── Data-driven overrides ────────────────────────────
            if (data && data.rows && data.rows.length > 0 && data.fields) {
                var row = data.rows[0];
                var fields = data.fields;
                for (var fi = 0; fi < fields.length; fi++) {
                    var fname = fields[fi].name;
                    var fval = row[fi];
                    if (fval === null || fval === undefined) continue;
                    if (fname === 'icon') resolvedIcon = sanitizeIconName(String(fval)) || resolvedIcon;
                    if (fname === 'color') iconColor = String(fval);
                    if (fname === 'label') { labelText = String(fval); showLabel = 'yes'; }
                    if (fname === 'value') {
                        var numVal = parseFloat(fval);
                        if (!isNaN(numVal)) {
                            if (numVal >= 90) iconColor = '#22C55E';
                            else if (numVal >= 50) iconColor = '#F59E0B';
                            else iconColor = '#EF4444';
                        }
                    }
                }
            }

            this._resolvedIcon = resolvedIcon;
            this._resolvedLabel = labelText;
            this._resolvedColor = iconColor;

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
        }
    });
});
