var _ = require('underscore');

function vectorAdd(x, y) {
    return _.map(_.zip(x, y), function (pair) {
        return pair[0] + pair[1];
    });
}

function vectorSubtract(x, y) {
    return _.map(_.zip(x, y), function (pair) {
        return pair[0] - pair[1];
    });
}

function vectorMagnitude(x) {
    var squaredSum = 0;
    _.each(x, function (v) {
        squaredSum += v * v;
    });
    return Math.sqrt(squaredSum);
}

function vectorMultiply(x, c) {
    return _.map(x, function (v) {
        return v * c;
    });
}

function vectorDivide(x, c) {
    return vectorMultiply(x, 1/c);
}

function gaussianKernel(x, y, sigma) {
    sigma = sigma || 0.00001;
    var l = vectorMagnitude(vectorSubtract(x, y));
    return Math.exp(-sigma * (l*l));
}

function normalizedKernel(kernel) {
    return function (x, y) {
        return kernel(x, y) / Math.sqrt(kernel(x, x) + kernel(y, y));
    };
}

var kernel = normalizedKernel(gaussianKernel);

function kernelDistance(x, y) {
    // return kernel(x, x) - 2 * kernel(x, y) + kernel(y, y); // general form
    return 2 - 2 * kernel(x, y); // for gaussian kernels
}

function Cluster(center) {
    this.center = center;

    /*
    tom: the papers say to initialize with weight zero, but that makes clusters
         you can't merge (dividing by zero), and initializing the size this way
         doesn't seem to hurt performance.
    */
    // this.size = 0;
    this.size = kernel(center, center);
}
Cluster.prototype = {
    add: function (e) {
        this.size += kernel(this.center, e);
        this.center = vectorAdd(this.center, vectorDivide(vectorSubtract(e, this.center), this.size));
    },
    merge: function (c) {
        this.center = vectorDivide(vectorAdd(vectorMultiply(this.center, this.size), vectorMultiply(c.center, c.size)), this.size + c.size);
        this.size += c.size;
    },
    resize: function (dim) {
        while (this.center.length < dim) {
            this.center.push(0);
        }
    },
    toString: function () {
        return 'Cluster(' + this.center + ', ' + this.size + ')';
    },
};

// the distance between 2 clusters
function ClusterDistance(cluster1, cluster2, distance) {
    this.cluster1 = cluster1;
    this.cluster2 = cluster2;
    this.distance = distance;
}
ClusterDistance.prototype = {
    compareTo: function (other) {
        return this.distance - other.distance;
    },
    toString: function () {
        return 'Dist(' + this.distance + ')';
    },
};

// will find at most N-1 clusters
// time taken is proportional to N
function OnlineCluster(N) {
    this.n = 0;
    this.N = N;
    this.clusters = [];
    this.numDimensions = 0; // max number of dimensions seen so far
    this.distances = []; // cache of inter-cluster distances
}
OnlineCluster.prototype = {
    resize: function (numDimensions) {
        this.clusters.forEach(function (c) {
            c.resize(numDimensions);
        });
        this.numDimensions = numDimensions;
    },
    cluster: function (e) {
        if (e.length > this.numDimensions) {
            this.resize(e.length);
        }

        if (this.clusters.length > 0) {
            var closest = _.min(this.clusters, function (x) {
                return kernelDistance(x.center, e);
            });
            closest.add(e);
            this.updateDistances(closest);
        }

        if (this.clusters.length >= this.N) {
            // merge closest two clusters
            var d = this.distances.shift();
            d.cluster1.merge(d.cluster2);
            this.clusters = _.without(this.clusters, d.cluster2);
            this.removeDistances(d.cluster2);
            this.updateDistances(d.cluster1);
        }

        // make a new cluster for this point
        var newCluster = new Cluster(e);
        this.clusters.push(newCluster);
        this.updateDistances(newCluster);

        this.n += 1;
    },
    // invalidate intercluster distance cache for c
    removeDistances: function (c) {
        this.distances = _.filter(this.distances, function (d) {
            return d.cluster1 !== c && d.cluster2 !== c;
        });
        this.heapify();
    },
    // Cluster c has changed, re-compute all intercluster distances
    updateDistances: function (c) {
        this.removeDistances(c);
        _.each(this.clusters, function (x) {
            if (x !== c) {
                var d = kernelDistance(x.center, c.center);
                var t = new ClusterDistance(x, c, d);
                this.distances.push(t);
            }
        }, this);
        this.heapify();
    },
    // doesn't really make it a heap; just sorts the array for now
    heapify: function () {
        this.distances.sort(function (a, b) {
            return a.compareTo(b);
        });
    },
    // Return only clusters over threshold
    trimmedClusters: function () {
        // find mean of clusters with size > 0
        var sum = 0, count = 0;
        _.each(this.clusters, function (c) {
            if (c.size > 0) {
                sum += c.size;
                count += 1;
            }
        });
        var mean = sum / count;
        var threshold = mean * 0.1;
        return _.filter(this.clusters, function (c) { return c.size >= threshold });
    },
};

exports.OnlineCluster = OnlineCluster;
