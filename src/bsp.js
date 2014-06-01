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


BSP.prototype.intersects = function intersects(value) {
    var intersects = [];
    this.root.findIntersection(value, function(v) {
        intersects.push(v);
    });
    return intersects;
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
    var middle = Math.floor((start + end) / 2);
    var node = new Node(values[middle],
                        getter(values[middle]),
                        getter(values[start]),
                        getter(values[end]));
    if (start < middle) {
        node.left = this.partition(values, getter, start, middle - 1);
    }
    if (middle < end) {
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
    this.left && this.visitInRange.call(this.left, min, max, visitor);
    if (this.value[1] >= min && this.value[0] <= max) {
        visitor(this.obj);
    }
    this.right && this.visitInRange.call(this.right, min, max, visitor);
};


Node.prototype.findIntersection = function(value, visitor) {
    this.left && this.findIntersection.call(this.left, value, visitor);
    if (this.value[0] <= value && this.value[1] >= value) {
        visitor(this.obj);
    }
    this.right && this.findIntersection.call(this.right, value, visitor);
};
