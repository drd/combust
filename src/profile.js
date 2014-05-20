/** @jsx React.DOM */

var Profiler = React.createClass({
    render: function() {
        return <div onWheel={this.handleScroll}>
            <h1>Profile</h1>
            <ProfileViewer samples={this.state}  />
            <DataGetter onChange={this.loadSamples} />
        </div>;
    },

    getInitialState: function() {
        return {
            data: [],
            maxStack: null,
            xOffset: 0,
            xScale: 10,
            yScale: 15
        };
    },

    handleScroll: function(e) {
        var xOffset = Math.min(
            Math.max(
                this.state.xOffset + e.deltaX, 0),
            this.state.data.length - window.innerWidth / this.state.xScale
        );
        this.setState({xOffset: xOffset});
        e.stopPropagation();
        e.preventDefault();
    },

    loadSamples: function(evt) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var samples = JSON.parse(e.target.result);
            this.setState({
                data: samples,
                maxStack: samples.reduce(function(a, s) {
                    return Math.max(a, s[3].length);
                }, 0)
            });
        }.bind(this);
        reader.readAsBinaryString(evt.target.files[0]);
    }
});


function eql(a, b) {
    if (!b) return false;

    return a.every(function(val, i) {
        return val == b[i];
    });
}


var ProfileViewer = React.createClass({
    processSlice: function(slice) {
        if (!slice.length) return [];

        var slice = JSON.parse(JSON.stringify(slice));
        for (var i = 1; i < slice.length; i++) {
            var sample = slice[i][3],

            prev = slice[i-1][3];
            for (var j = 0; j < sample.length; j++) {
                if (eql(sample[j], prev[j])) {
                    sample[j].hide = true;
                    if (prev[j].orig) {
                        prev[j].orig.width++;
                    } else {
                        prev[j].orig = prev[j];
                        prev[j].orig.width = 2;
                    }
                    sample[j].orig = prev[j].orig;
                } else {
                    sample[j].width = 1;
                }
            }
        }

        return slice;
    },

    render: function() {
        var xScale = this.props.samples.xScale;
        var width = 0;
        if (this.isMounted()) {
            var width = Math.floor(this.getDOMNode().clientWidth / xScale);
        }
        var slice = this.props.samples.data.slice(
            this.props.samples.xOffset, this.props.samples.xOffset + width
        );
        slice = this.processSlice(slice);

        return <div>
            <h2>Length: {this.props.samples.data.length}</h2>
            <h2>Stack: {this.props.samples.maxStack}</h2>
            <h2>Offset: {this.props.samples.xOffset}</h2>
            <div className="samples">
                {slice.map(function(s) {
                    return <SampleStack key={s[0]} sample={s} xScale={xScale} yScale={this.props.samples.yScale} />;
                }.bind(this))}
            </div>
        </div>;
    }
});


var SampleStack = React.createClass({
    render: function() {
        var xScale = this.props.xScale;
        var stackStyle = {
            width: xScale
        };
        return <div className="stack" style={stackStyle}>
            {this.props.sample[3].reverse().map(function(s, i) {
                var sampleStyle = {
                    width: s.width * xScale,
                    height: this.props.yScale,
                    backgroundColor: 'hsl(' + [i * 5, '90%', '80%'] + ')'
                };
                var txt = s[3] + '/' + s[1];
                var key = i + txt;
                return <div key={key} style={sampleStyle} className={s.hide ? 's hide' : 's'}>{txt}</div>;
            }.bind(this))}
        </div>;
    }
})


var DataGetter = React.createClass({
    render: function() {
        return <input type="file" name="data" onChange={this.props.onChange} />;
    }
})


React.renderComponent(
    <Profiler/>
    , $('#profile')[0]
);
