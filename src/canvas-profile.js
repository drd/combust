var profile = document.getElementById('profile');
var overlay = document.getElementById('overlay');

function hsl(h, s, l) {
    return 'hsl(' + [h, s + '%', l + '%'] + ')';
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
            bgColor: 'rgba(0, 0, 0, 0.3)',
            color: '#fff'
        }
    },
    setState: function(state) {
        var fn = App.render.bind(this);

        for (var key in state) {
            if (state.hasOwnProperty(key)) {
                if (state[key] !== this.state[key]) {
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
        App.prev = App.state;
        App.state = $.extend(App.prev || {}, state);
    },
    boot: function(samples) {
        this.samples = this.preProcess(samples);
        this.profileContext = profile.getContext('2d');
        this.overlayContext = overlay.getContext('2d');
        this.render();
        $(overlay).on('mousewheel', function(e) {
            var xOffset = Math.min(
                Math.max(this.state.xOffset + e.deltaX, 0),
                this.samples.length - (Math.floor(window.innerWidth / this.state.xScale)));
            this.setState({
                xOffset: xOffset,
                hovered: null
            });
            return false;
        }.bind(this));
        $('#width').on('change', function(e) {
            var delta = {
                xScale: parseInt(e.target.value, 10),
                xOffset: this.state.xOffset,
                hovered: null
            };

            var samplesVisible = Math.floor(window.innerWidth / delta.xScale);
            // adjust xOffset in the case that a change to a narrower width
            // would cause the chart to go beyond the end of the samples
            if (delta.xOffset + samplesVisible > this.samples.length) {
                delta.xOffset = this.samples.length - samplesVisible;
            }
            this.setState(delta);
        }.bind(this));
        $(overlay).on('mousemove', function(e) {
            var x = Math.floor(e.offsetX / this.state.xScale) + this.state.xOffset;
            var height = Math.floor(profile.offsetHeight / this.state.yScale);
            var y = height - Math.floor(e.offsetY / this.state.yScale) - 1;
            var delta = {hovered: this.samples[x][y]};
            if (delta.hovered) {
                delta.hoverX = e.offsetX;
                delta.hoverY = e.offsetY;
            } else {
                delta.hovered = null;
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
    render: function() {
        console.time('render');
        profile.width = window.innerWidth;
        profile.height = window.innerHeight - profile.offsetTop;
        var context = this.profileContext;
        var width = profile.width;
        var height = profile.height;
        var samplesVisible = Math.floor(width / this.state.xScale);
        var yScale = this.state.yScale;
        var xScale = this.state.xScale;

        // for offscreen text rendering
        var subcanvas = document.createElement('canvas');
        subcanvas.width = width;
        subcanvas.height = 16;
        var subctx = subcanvas.getContext('2d');
        subctx.setFillColor('#000')

        var y = height;

        for (var j = 0; j < this.samples.height; j++) {
            var x = 0;
            y -= this.state.yScale;

            // set fill & stroke color once
            context.setFillColor(hsl(j * this.ui.hueShift, this.ui.fill.saturation, this.ui.fill.lightness));
            context.setStrokeColor(hsl(j * this.ui.hueShift, this.ui.stroke.saturation, this.ui.stroke.lightness));

            for (var i = 0; i < samplesVisible; i++) {
                var frame = this.samples[this.state.xOffset + i][j];
                if (!frame) {
                    x += xScale;
                    continue;
                }
                var text = frame.fn;

                var frameWidth = frame.width * xScale;

                context.fillRect(x, y, frameWidth, yScale);

                if (frameWidth > this.ui.stroke.threshold) {
                    context.strokeRect(x, y, frameWidth, yScale);
                }

                if (frameWidth > this.ui.text.threshold) {
                    subctx.clearRect(0, 0, subcanvas.width, subcanvas.height);
                    subctx.fillText(text, 0, yScale);
                    var textWidth = this.measureText(text);
                    var textDrawWidth = Math.min(textWidth, frameWidth);

                    context.drawImage(subcanvas, 0, 0, textDrawWidth, 16,
                                      x, y - 3, textDrawWidth, 16);
                }

                i += frame.width - 1;
                x += xScale * frame.width;
            }
        }

        // clear hover on redraw
        this.overlayContext.clearRect(0, 0, overlay.width, overlay.height);
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
            hovered.file + ' (' + hovered.lineNumber + ')'
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

        processed = samples.map(function() { return Array(height); });
        processed.height = height;

        // loop through all samples, set processed[sample][frame] to
        // - undefined if the stack was not that high OR
        // - a cell containing:
        //     - the number of samples at this depth which represent
        //       the same function call
        //     - the string representation of that function call
        var duration = 0;
        for (var i = 0; i < width; i++) {
            var stack = processed[i];
            var width;
            for (var j = 0; j < samples[i][3].length; j++) {
                // skip if we have been here already
                if (processed[i][j]) {
                    continue;
                }
                var cell = frameFromJson(samples[i][3][j]);
                var frameWidth = 1;

                // find all adjacent cells that match this frame
                for (var k = i + 1; (k < width &&
                                     samples[k][3][j] &&
                                     samples[k][3][j][0] == cell.file &&
                                     samples[k][3][j][1] == cell.lineNumber);
                     k++, frameWidth++) {
                    processed[k][j] = frameFromJson(samples[k][3][j]);
                    processed[k][j].orig = i;
                }

                // update the current cell width
                cell.width = frameWidth;
                processed[i][j] = cell;
                var w = frameWidth - 1;

                // mark the width of the remaining cells
                for (var k = i + 1; k < i + frameWidth; k++) {
                    processed[k][j].width = w--;
                }
            }
        }
        console.timeEnd('prep');
        console.log('total duration: ', duration);
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
