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

	return mb.toFixed(2) + 'MB'
}

let target = '..'

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

	// console.log('process', dir, name)

	fs.lstat(dir, (err, stat) => {

		let size = stat.size;
		// console.log(dir, stat.blocks, stat.blocks * 512, stat.size)

		if (err) {
			console.error(err.stack)
			return callback(err)
		}

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

console.log('lets go');
console.time('async2')
let queue = async.queue(test, 10)

queue.drain = function() {
    console.log("All files are uploaded");
    console.timeEnd('async2')

    console.log(json);

    onJson(null, json)
};

var json = {};
queue.push({parent: '..', node: json})


/*
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
*/