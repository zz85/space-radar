() => {
'use strict'

const fs = require('fs')
const path = require('path')

let counter = 0;

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
	if (counter % 10000 === 0) {
		if (options.onprogress) options.onprogress(dir, name);
		// if (counter % 10000 === 0) console.log('scanning', counter, dir);
		if (counter % 100000 === 0) if (options.onrefresh) options.onrefresh(dir, name);
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
						onprogress: options.onprogress,
						onrefresh: options.onrefresh
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