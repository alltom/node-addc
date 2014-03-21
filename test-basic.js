var test = require('tap').test;
var OnlineCluster = require('./').OnlineCluster;

test(function (t) {
	t.plan(1);

	var c = new OnlineCluster(10);

	for (var i = 0; i < 100; i++) {
		c.cluster([Math.random(), Math.random(), Math.random()]);
	}

	var clusters = c.trimmedClusters();
	t.ok(clusters.length > 0);
});
