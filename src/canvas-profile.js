var canvas = document.getElementById('profile');
var context = canvas.getContext('2d');

var App = {
    samples: null,
    state: {
        xOffset: 0
    },
    setState: function(state) {
        App.prev = App.state;
        App.state = state;
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
            }

            // update the current cell width
            cell.width = frameWidth;
            var w = frameWidth - 1;

            // mark the width of the remaining cells
            for (var k = i + 1; k < i + frameWidth; k++) {
                processed[k][j].width = w--;
            }
        }
    }

    window.requestAnimationFrame()
    console.timeEnd('prep');
});

function drawSamples()
