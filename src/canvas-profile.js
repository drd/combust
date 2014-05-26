var canvas = document.getElementById('profile');

function hsl(h, s, l) {
    return 'hsl(' + [h, s + '%', l + '%'] + ')';
}

var App = {
    samples: null,
    state: {
        xOffset: 0,
        frameHeight: 15,
        frameWidth: 15
    },
    setState: function(state) {
        for (var key in state) {
            if (state.hasOwnProperty(key)) {
                if (state[key] !== this.state[key]) {
                    window.requestAnimationFrame(App.render.bind(this));
                }
            }
        }
        App.prev = App.state;
        App.state = $.extend(App.prev || {}, state);
    },
    preProcess: function(samples) {
        console.time('prep');

        // final value in samples is a sentinel
        var width = samples.length - 1;
        // maximum height of stacktrace
        var height = samples.reduce(
            function(m, s) { return Math.max(m, s[3].length)}, 0);

        processed = samples.map(function() { return Array(height); });

        // loop through all samples, set processed[sample][frame] to
        // - undefined if the stack was not that high OR
        // - a cell containing:
        //     - the number of samples at this depth which represent
        //       the same function call
        //     - the string representation of that function call
        for (var i = 0; i < width; i++) {
            var stack = processed[i];
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
        return processed;
    },
    boot: function(samples) {
        this.samples = this.preProcess(samples);
        this.context = canvas.getContext('2d');
        this.render();
        $(canvas).on('mousewheel', function(e) {
            var xOffset = Math.min(
                Math.max(this.state.xOffset + e.deltaX, 0),
                this.samples.length - (Math.floor(window.innerWidth / this.state.frameWidth)));
            this.setState({xOffset: xOffset});
            return false;
        }.bind(this));
        $('#width').on('change', function(e) {
            this.setState({frameWidth: parseInt(e.target.value, 10)})
        }.bind(this));
    },
    textWidthCache: {},
    measureText: function(str) {
        if (!this.textWidthCache[str]) {
            this.textWidthCache[str] = this.context.measureText(str).width;
        }
        return this.textWidthCache[str];
    },
    render: function() {
        console.time('render');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        var context = this.context;
        var width = canvas.width;
        var height = canvas.height;
        var samplesVisible = Math.floor(width / this.state.frameWidth);

        var seen = [];
        for (var i = 0; i < samplesVisible; i++) {
            seen[i] = [];
        }

        var x = 0;

        var subcanvas = document.createElement('canvas');
        subcanvas.width = width;
        subcanvas.height = 16;
        var subctx = subcanvas.getContext('2d');
        //subctx.globalCompositeOperation = 'source-in';

        for (var i = 0; i < samplesVisible; i++) {
            var y = height;
            var frames = this.samples[i + this.state.xOffset];
            for (var j = 0; frames[j] && j < frames.length; j++) {
                y -= this.state.frameHeight;
                if (seen[i][j]) {
                    continue;
                }
                var frame = frames[j];
                var text = frame.fn;

                var frameWidth = frame.width * this.state.frameWidth;
                subctx.clearRect(0, 0, subcanvas.width, subcanvas.height);
                subctx.setFillColor('#000')
                subctx.fillText(text, 0, this.state.frameHeight);
                var textWidth = this.measureText(text);
                var textDrawWidth = Math.min(textWidth, frameWidth);

                context.setFillColor(hsl(j * 5, 70, 70));
                context.fillRect(x, y, frameWidth, this.state.frameHeight);
                context.setStrokeColor(hsl(j * 5, 80, 60));
                context.strokeRect(x, y, frame.width * this.state.frameWidth, this.state.frameHeight);

                context.drawImage(subcanvas, 0, 0, textDrawWidth, 16,
                                             x, y - 3, textDrawWidth, 16);
                // context.setFillColor('#000')
                // context.fillText(frame.fn, x, y + this.state.frameHeight);
                for (var k = 1; k < frame.width && i + k < samplesVisible; k++) {
                    seen[i + k][j] = true;
                }
            }
            x += this.state.frameWidth;
        }
        console.timeEnd('render');
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
