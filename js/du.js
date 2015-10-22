() => {
'use strict'

const fs = require('fs')
const path = require('path')

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

module.exports = descendFS

}()