function BSP(values, options) {
    this.getter = options.getter;
    this.root = Node.partition(values, this.getter);
}


BSP.prototype.inRange = function inRange(min, max) {
    var ranged = [];
    this.root.visitInRange(min, max, function(v) {
        ranged.push(v);
    });
    return ranged;
};


function Node(obj, value, min, max) {
    this.obj = obj;
    this.value = value;
    this.min = min;
    this.max = max;
}


Node.partition = function partition(values, getter, start, end) {
    if (start === undefined && end === undefined) {
        start = 0;
        end = values.length - 1;
    }
    var middle = Math.round((start + end) / 2);
    var node = new Node(values[middle],
                        getter(values[middle]),
                        getter(values[start]),
                        getter(values[end]));
    if (start < end) {
        node.left = this.partition(values, getter, start, middle - 1);
        node.right = this.partition(values, getter, middle + 1, end);
    }
    return node;
};


Node.prototype.inOrder = function walk(visitor) {
    if (this.value) {
        this.inOrder.call(this.left, visitor);
        visitor(this.obj);
        this.inOrder.call(this.right, visitor);
    }
};


Node.prototype.visitInRange = function(min, max, visitor) {
    if (max < this.min || min > this.max) {
        return;
    }
    this.left && this.visitInRange.call(this.left, min, max, visitor);
    if (this.value >= min && this.value <= max) {
        visitor(this.obj);
    }
    this.right && this.visitInRange.call(this.right, min, max, visitor);
};
