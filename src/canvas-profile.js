var profile = document.getElementById('profile');
var overlay = document.getElementById('overlay');

function hsl(h, s, l) {
    return 'hsl(' + [h, s + '%', l + '%'] + ')';
}

function memoize(fn) {
    var cache = {};
    return function(arg) {
        if (cache[arg]) {
            return cache[arg];
        }
        return cache[arg] = fn.call(this, arg);
    }
}

var App = {
    samples: null,
    state: {
        xOffset: 0,
        yScale: 15,
        xScale: 15,
        hovered: undefined,
        hoverX: undefined,
        hoverY: undefined
    },
    ui: {
        padding: 3,
        hueShift: 4,
        fill: {
            saturation: 70,
            lightness: 70
        },
        stroke: {
            threshold: 10,
            saturation: 80,
            lightness: 60
        },
        text: {
            size: parseInt($(document.body).css('fontSize'), 10),
            lineHeight: 13,
            threshold: 20
        },
        hover: {
            bgColor: 'rgba(0, 0, 0, 0.4)',
            color: '#fff'
        }
    },
    setState: function(state) {
        var fn = App.render.bind(this);

        App.prev = App.state;
        App.state = $.extend({}, App.prev || {}, state);

        for (var key in state) {
            if (state.hasOwnProperty(key)) {
                if (state[key] !== this.prev[key]) {
                    // derpy hack to not re-render everything
                    if (key.indexOf('hover') != -1) {
                        // let's not redraw the whole board
                        fn = App.drawHover.bind(this);
                    }
                    window.requestAnimationFrame(fn);
                    break;
                }
            }
        }
    },
    boot: function(samples) {
        this.samples = this.preProcess(samples);
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenContext = this.offscreenCanvas.getContext('2d');
        this.profileContext = profile.getContext('2d');
        this.overlayContext = overlay.getContext('2d');
        this.render();
        $('#width').val(this.state.xScale);
        $('#width').on('change', function(e) {
            var delta = {
                xScale: parseFloat(e.target.value, 10),
                xOffset: this.state.xOffset,
                hovered: null
            };

            var timeVisible = this.samples.duration * delta.xScale * .01;
            // adjust xOffset in the case that a change to a narrower width
            // would cause the chart to go beyond the end of the samples
            if (delta.xOffset + timeVisible > this.samples.duration) {
                delta.xOffset = this.samples.duration - timeVisible;
            }
            this.setState(delta);
        }.bind(this));
        $('#height').val(this.state.xScale);
        $('#height').on('change', function(e) {
            var delta = {
                yScale: parseFloat(e.target.value, 10),
                hovered: null
            };
            this.setState(delta);
        }.bind(this))
        $(overlay).on('mousewheel', function(e) {
            var xOffset = Math.min(
                Math.max(this.state.xOffset + e.deltaX * this.state.xScale / 100, 0),
                this.samples.duration * ((100 - this.state.xScale) / 100));
            this.setState({
                xOffset: xOffset,
                hovered: null
            });
            return false;
        }.bind(this));
        $(overlay).on('mousemove', function(e) {
            var x = e.offsetX / profile.width * this.samples.duration * this.state.xScale / 100 + this.state.xOffset;
            var y = Math.floor((profile.offsetHeight - e.offsetY) / this.state.yScale);
            var candidates = this.samples.bsp.intersects(x);
            var frame = candidates.filter(function(c) { return c.depth == y});
            var delta = {hovered: null};
            if (frame.length) {
                delta.hovered = frame[0];
                delta.hoverX = e.offsetX;
                delta.hoverY = e.offsetY;
            }
            this.setState(delta);
        }.bind(this));
        $(window).on('resize', function(e) {
            window.requestAnimationFrame(App.render.bind(this));
        }.bind(this));
    },
    textWidthCache: {},
    measureText: function(str) {
        if (!this.textWidthCache[str]) {
            this.textWidthCache[str] = this.profileContext.measureText(str).width;
        }
        return this.textWidthCache[str];
    },
    fillForDepth: memoize(function(depth) {
        return hsl(depth * this.ui.hueShift,
                   this.ui.fill.saturation,
                   this.ui.fill.lightness);
    }),
    strokeForDepth: memoize(function(depth) {
        return hsl(depth * this.ui.hueShift,
                   this.ui.stroke.saturation,
                   this.ui.stroke.lightness);
    }),
    render: function() {
        console.time('render');
        profile.width = window.innerWidth;
        profile.height = window.innerHeight - profile.offsetTop;
        this.offscreenCanvas.width = profile.width;
        this.offscreenCanvas.height = profile.height;
        var context = this.offscreenContext;
        var width = profile.width;
        var height = profile.height;
        // xScale is percent of samples visible
        var timeVisible = this.samples.duration * (this.state.xScale * 0.01);
        // TODO: rename this, possibly to xScale, thus renaming xScale to something like xZoom
        var size = width / timeVisible;
        var yScale = this.state.yScale;

        // for offscreen text rendering
        var subcanvas = document.createElement('canvas');
        subcanvas.width = width;
        subcanvas.height = 16;
        var subctx = subcanvas.getContext('2d');
        subctx.setFillColor('#000')

        var y = height;

        var visibleSamples = this.samples.bsp.inRange(
            this.state.xOffset,
            this.state.xOffset + timeVisible);

        for (var i = 0; i < visibleSamples.length; i++) {
            var frame = visibleSamples[i];
            y = height - yScale * (frame.depth + 1);
            if ((i == 0) || (i > 0 && frame.depth != visibleSamples[i-1].depth)) {
                context.setFillColor(this.fillForDepth(frame.depth));
            }
            var frameWidth = frame.duration * size;
            var x = (frame.t - this.state.xOffset) * size;
            if (x < 0) {
                // adjust width to compensate and draw from the left edge of the screen
                frameWidth += x;
                x = 0;
            }
            var text = frame.fn;
            context.fillRect(x, y, frameWidth, yScale);

            if (frameWidth > this.ui.text.threshold) {
                subctx.clearRect(0, 0, subcanvas.width, subcanvas.height);
                subctx.fillText(text, 0, yScale);
                var textWidth = this.measureText(text);
                var textDrawWidth = Math.min(textWidth, frameWidth);

                context.drawImage(subcanvas, 0, 0, textDrawWidth, 16,
                                  x, y - 3, textDrawWidth, 16);
            }
        }
        // for (var j = 0; j < this.samples.height; j++) {
        //     y -= this.state.yScale;

        //     // set fill & stroke color once
        //     context.setFillColor(hsl(j * this.ui.hueShift, this.ui.fill.saturation, this.ui.fill.lightness));
        //     context.setStrokeColor(hsl(j * this.ui.hueShift, this.ui.stroke.saturation, this.ui.stroke.lightness));

        //     var tMax = -1;

        //     for (var i = 0; i < visibleSamples.length; i++) {
        //         var sample = visibleSamples[i];
        //         var frame = sample[j];
        //         if (!frame || sample.t < tMax) {
        //             continue;
        //         }
        //         tMax = sample.t + frame.duration;

        //         var frameWidth = frame.duration * size;
        //         var x = (sample.t - this.state.xOffset) * size;
        //         if (x < 0) {
        //             // adjust width to compensate and draw from the left edge of the screen
        //             frameWidth += x;
        //             x = 0;
        //         }
        //         var text = frame.fn;


        //         context.fillRect(x, y, frameWidth, yScale);

        //         if (frameWidth > this.ui.stroke.threshold) {
        //             context.strokeRect(x, y, frameWidth, yScale);
        //         }

        //         if (frameWidth > this.ui.text.threshold) {
        //             subctx.clearRect(0, 0, subcanvas.width, subcanvas.height);
        //             subctx.fillText(text, 0, yScale);
        //             var textWidth = this.measureText(text);
        //             var textDrawWidth = Math.min(textWidth, frameWidth);

        //             context.drawImage(subcanvas, 0, 0, textDrawWidth, 16,
        //                               x, y - 3, textDrawWidth, 16);
        //         }
        //     }
        // }

        // clear hover on redraw
        this.overlayContext.clearRect(0, 0, overlay.width, overlay.height);
        this.profileContext.drawImage(this.offscreenCanvas, 0, 0);
        console.timeEnd('render');
    },
    drawHover: function() {
        var context = this.overlayContext;
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        var hovered = this.state.hovered;
        if (!hovered) {
            return;
        }
        var left = this.state.hoverX;
        var top = this.state.hoverY;
        var lines = [
            hovered.line ? hovered.line + ' [' + hovered.fn + ']' : hovered.fn,
            hovered.file + ' (' + hovered.lineNumber + ')',
            (hovered.duration * 1000) + 'ms'
        ];
        var width = lines.reduce(function(max, line) {
            var width = this.measureText(line);
            return Math.max(max, width);
        }.bind(this), 0) + this.ui.padding * 2;
        var height = lines.length * (this.ui.text.lineHeight) + this.ui.padding;

        if (width + left > overlay.offsetWidth) {
            left += overlay.offsetWidth - (width + left) - this.ui.padding;
        }

        if (height + top > overlay.offsetHeight) {
            top += overlay.offsetHeight - (height + top) - this.ui.padding;
        }

        context.setFillColor(this.ui.hover.bgColor);
        context.fillRect(left, top, width, height);
        context.setFillColor(this.ui.hover.color);
        lines.forEach(function(line, i) {
            context.fillText(line, left + this.ui.padding, top + (i + 1) * this.ui.text.lineHeight);
        }.bind(this));
    },
    preProcess: function(samples) {
        // input format:
        // an array of samples
        // [
        //    0: timestamp
        //    1: thread id
        //    2: thread name
        //    3: stack, array: [
        //       ...: array: [
        //         0: filename
        //         1: line number
        //         2: function
        //         3: line
        //       ]
        //    ]
        // ]
        console.time('prep');

        // final value in samples is a sentinel
        var width = samples.length - 1;
        // maximum height of stacktrace
        var height = samples.reduce(
            function(m, s) { return Math.max(m, s[3].length)}, 0);

        var processed = [];
        processed.height = height;
        processed.duration = samples[width][0] - samples[0][0];
        console.log('total duration: ', processed.duration);

        // loop through all samples, append frames to processed
        // - processed[n].t will be the time offset of that sample,
        //   starting with processed[0].t == 0
        // - undefined if the stack was not that high OR
        // - a frame containing:
        //     - the string representation of that function call
        //     - the time offset of the sample containing this frame as frame.t
        //     - the stack depth of this call as frame.depth
        //     - the length of that function call as defined by the interval
        //       processed[sample].t to processed[n].t where processed[n][frame]
        //       represents the first different function call


        var initialTime = samples[0][0];

        for (var i = 0; i < width; i++) {
            var t = samples[i][0] - initialTime;

            for (var j = 0; j < samples[i][3].length; j++) {
                // skip if we have been here already
                if (samples[i][3][j] && samples[i][3][j].skip) {
                    continue;
                }
                var cell = frameFromJson(samples[i][3][j]);

                // find all adjacent cells that match this frame,
                // mark them as Nothing
                for (var k = i + 1; (k < width &&
                                     samples[k][3][j] &&
                                     samples[k][3][j][0] == cell.file &&
                                     samples[k][3][j][1] == cell.lineNumber);
                     k++) {
                    samples[k][3][j].skip = true;
                }

                var finalTime = samples[k][0] - initialTime;
                cell.t = t;
                cell.duration = finalTime - t;
                cell.depth = j;

                processed.push(cell);
            }
        }

        processed.bsp = new BSP(processed, {
            getter: function(frame, kind) {
                var min = frame.t;
                var max = frame.t + frame.duration;
                return [min, max];
            }
        });
        console.timeEnd('prep');

        return processed;
    }
}

function frameFromJson(cell) {
    return {
        file: cell[0],
        lineNumber: cell[1],
        fn: cell[2],
        line: cell[3]
    };
}

$.getJSON('/samples.json').done(function(samples) {
    App.boot(samples);
});
