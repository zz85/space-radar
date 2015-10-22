() => {
'use strict'

const fs = require('fs')
const path = require('path')

let target = '../../..'
let counter = 0;

/* Synchronous File System descender */
function jsonFS(parent, name, ret) {
	counter++;

	let dir = name ? path.join(parent, name) : parent
	name = name ? name : parent;

	if (counter % 100000 == 0) console.log(counter, dir);

	try {
		let stat = fs.lstatSync(dir)
		if (stat.isSymbolicLink()) {
			ret.name = name;
			ret.size = 0;

		} else if (stat.isFile()) {
			ret.name = name;
			ret.size = stat.size;
		}
		else if (stat.isDirectory()) {
			let files = fs.readdirSync(dir)

			ret.name = name;
			ret.children = [];

			files.forEach(file => {
				let child = {}
				ret.children.push(child)
				jsonFS(dir, file, child)

				// let child = jsonFS(dir, file, {})
				// if (child) ret.children.push(child)
			})
		}

	} catch (e) {
		console.error(e.stack)
	}

	return ret
}

/* Asynchronous File System descender */
function descendFS(options, done) {
	let dir, name, node

	node = options.node

	if (!options.name) {
		dir = options.parent
		name = options.parent
	} else {
		dir = path.join(options.parent, options.name)
		name = options.name
	}

	counter++
	if (counter % 1000 === 0) {
		if (options.onprogress) options.onprogress(dir, name);
		if (counter % 10000 === 0) console.log('scanning', counter, dir);
	}

	fs.lstat(dir, (err, stat) => {
		if (err) {
			console.log(err.stack)
			return done(dir)
		}

		let size = stat.size;
		// console.log(dir, stat.blocks, stat.blocks * 512, stat.size)

		if (stat.isSymbolicLink()) return done(dir)

		if (stat.isFile()) {
			node.name = name
			node.size = size
			return done(dir)
		}

		if (stat.isDirectory()) {
			node.name = name;
			// node.size = size;
			node.children = []

			fs.readdir(dir, (err, list) => {
				if (err) {
					console.error(err.stack)
					return done(dir)
				}

				var left = list.length;

				function ok(bla) {
					left--;
					if (left === 0) done(name)
				}

				list.forEach(file => {
					let childNode = {};
					node.children.push(childNode)
					descendFS({
						parent: dir,
						name: file,
						node: childNode,
						onprogress: options.onprogress
					}, ok)
				});

				if (!left) done(name)
			})

			return
		}

		return done(dir)
	})
}

var INCREMENTAL_INTERVAL = 5000

console.log('lets go');
console.time('async2')
// loading.style.display = 'inline-block'

function complete() {
    console.log("Scan completed", counter, "files");
    console.timeEnd('async2')
    clearTimeout(checker)
    // loading.style.display = 'none'

    console.log(json);

    console.time('write')
    fs.writeFileSync('test.json', JSON.stringify(json))
    console.timeEnd('write')

    onJson(null, clone2(json))
};

let checker

var json = {};

function updatePartialFS() {
	clearTimeout(checker)
	console.log('scanning...');
	console.time('clone')
	let cloneJson = clone2(json)
	console.log(cloneJson)
	console.timeEnd('clone')
	onJson(null, cloneJson)
	checker = setTimeout(updatePartialFS, INCREMENTAL_INTERVAL)
}

target = path.resolve(target)
console.log('Scanning target', target)

// d3.json("flare.json", onJson);

setTimeout( () => {
	// jsonFS(target, null, json)
	// complete()

	descendFS({
		parent: target,
		node: json,
		onprogress: window.onProcess
	}, complete)

	// updatePartialFS();

	setTimeout(updatePartialFS, INCREMENTAL_INTERVAL);

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