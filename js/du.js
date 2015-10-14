() => {
'use strict'

const fs = require('fs')
const path = require('path')

function explore(dir, level) {
	level = level || 0
	level ++
	let total = 0

	try {
		let stat = fs.lstatSync(dir)
		if (stat.isFile())
		  total += stat.size
		else if (stat.isDirectory()) {
			let files = fs.readdirSync(dir)
			files.forEach(file => {
				total += explore(path.join(dir, file), level)
			})
			// for (let f = 0; f < files.length; f++) {
			// 	total += explore(path.join(dir, files[f]), level)
			// }
		}

		// if (level <= 2) console.log(format(total), dir, level)
	} catch (e) {
		console.error(e.stack)
	}

	return total
}

function jsonFS(parent, name, level) {
	level = level || 0
	level ++
	let ret;

	let dir = name ? path.join(parent, name) : parent
	name = name ? name : parent;

	try {
		let stat = fs.lstatSync(dir)
		if (stat.isFile()) {
			ret = {
				name: name,
				size: stat.size
			}
		}
		else if (stat.isDirectory()) {
			let files = fs.readdirSync(dir)
			ret = {
				name: name,
				children: []
			}
			files.forEach(file => {
				let child = jsonFS(dir, file, level)
				if (child) ret.children.push(child)
			})
		}

		// if (level <= 2) console.log(format(total), dir, level)
	} catch (e) {
		console.error(e.stack)
	}

	return ret
}



function format(bytes) {
	let kb = bytes / 1024;
	let mb = bytes / 1024 / 1024;
	let gb = bytes / 1024 / 1024 / 1024;
	let tb = bytes / 1024 / 1024 / 1024 / 1024;

	var units = {
		KB: kb,
		MB: mb,
		GB: gb,
		TB: tb,
	};

	var last_unit = 'B';
	var last_value = bytes;
	for (var u in units) {
		if (units[u] < 1) {
			return last_value + last_unit
		}
		last_unit = u;
		last_value = units[u].toFixed(2);
	}
	return last_value + last_unit
}

window.format = format;

let target = '../../..'
// DNF - /

let async = require("async")

function test(options, callback) {
	// console.log('test', arguments);


	let dir, name, node;
	node = options.node;
	if (!options.name) {
		dir = options.parent
		name = options.parent
	} else {
		dir = path.join(options.parent, options.name)
		name = options.name
	}

	if (Math.random() < 0.01)
		console.log('process', dir, name)

	fs.lstat(dir, (err, stat) => {
		if (err) {
			console.error(err.stack)
			return callback(err)
		}

		let size = stat.size;
		// console.log(dir, stat.blocks, stat.blocks * 512, stat.size)

		if (stat.isFile()) {
			// console.log(name);
			node.name = name;
			node.size = size;
			return callback(null, 0)
		}

		if (stat.isDirectory()) {
			return fs.readdir(dir, (err, list) => {
				if (err) console.error(err.stack)

				node.name = name;
				// node.size = size;
				node.children = []


				list.forEach(file => {
					let childNode = {};
					node.children.push(childNode)
					queue.push({parent: dir, name: file, node: childNode})
				}
				);

				callback(null, 0);
			})
		}

		// console.log('ohoh', stat)
		callback();
	})
}

var INCREMENTAL_INTERVAL  = 5000

console.log('lets go');
console.time('async2')
loading.style.display = 'inline-block'
let queue = async.queue(test, 10)

queue.drain = function() {
    console.log("All files are uploaded");
    console.timeEnd('async2')
    clearTimeout(checker)
    loading.style.display = 'none'

    console.log(json);

    console.time('write')
    fs.writeFileSync('test.json', JSON.stringify(json))
    console.timeEnd('write')

    onJson(null, clone2(json))
};

var json = {};

let checker

function updatePartialFS() {
	clearTimeout(checker)
	console.log('scanning...');
	console.time('clone')
	let cloneJson = clone2(json)
	console.timeEnd('clone')
	onJson(null, cloneJson)
	// checker = setTimeout(updatePartialFS, INCREMENTAL_INTERVAL);
}

queue.push({parent: target, node: json})

setTimeout(updatePartialFS, 1000)


function clone(json) {
	return JSON.parse(JSON.stringify(json))
}

function clone2(source, target) {
	if (!target) target = {};


	if (source.name) target.name = source.name;
	if (source.size) target.size = source.size;
	if (source.children) {
		target.children = [];
		source.children.forEach( node => {
			target.children.push(clone2(node, {}))
		})
	}

	return target;
}

/*
// Synchronous fashion
console.time('jsonFS')
var json = jsonFS(target)
// fs.writeFileSync('test.json', JSON.stringify(json))
console.log('json', json)
console.timeEnd('jsonFS')
*/



/*
console.time('sync')
console.log(fs, path, format(explore(target)));
console.timeEnd('sync')


let du = require('du')
console.time('du')
du(
	target
  // , { filter: function (f) { return /\.sst$/.test(f) } }
  , function (err, size) {
	  console.log('The size is:', format(size), 'bytes')
	  console.timeEnd('du')
	}
)


clone: 101.325ms
bipartition_sunburst.js:224 compute1: 679.538ms
bipartition_sunburst.js:244 compute2: 1215.207ms
bipartition_sunburst.js:246 ROOT SIZE 51.10GB


clone: 157.148ms
bipartition_sunburst.js:224 compute1: 326.347ms
bipartition_sunburst.js:244 compute2: 1160.225ms
bipartition_sunburst.js:246 ROOT SIZE 40.68GB

24MB - 100GB

*/

}()