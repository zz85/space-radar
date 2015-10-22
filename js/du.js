() => {
'use strict'

const fs = require('fs')
const path = require('path')

let target = '../..'
let async = require("async")

let counter = 0;

/* Asynchronous File System descender */
function descendFS(options, callback) {
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

	counter++;
	if (counter % 1000 === 0) {
		if (window.onProcess) window.onProcess(dir, name);
		// console.log('process', dir, name)
		if (counter % 10000 === 0) console.log('scanned', counter);
	}

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

var INCREMENTAL_INTERVAL = 5000

console.log('lets go');
console.time('async2')
loading.style.display = 'inline-block'
let queue = async.queue(descendFS, 10)

queue.drain = function() {
    console.log("Scan completed", counter, "files");
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
	checker = setTimeout(updatePartialFS, INCREMENTAL_INTERVAL)
}

target = path.resolve(target)
console.log('Scanning target', target)

// d3.json("flare.json", onJson);

setTimeout( () => {
	queue.push({parent: target, node: json})
	updatePartialFS();

	// for testing purposes only
	// json = fs.readFileSync('user.json', { encoding: 'utf-8'})
	// loading.style.display = 'none'
	// onJson(null, JSON.parse(json).children[10])
	// onJson(null, JSON.parse(json))
})


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

}()