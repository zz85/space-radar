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


function format(bytes) {
	let kb = bytes / 1024;
	let mb = bytes / 1024 / 1024;
	let gb = bytes / 1024 / 1024 / 1024;
	let tb = bytes / 1024 / 1024 / 1024 / 1024;

	return mb.toFixed(2) + 'MB'
}

let target = '../..'
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
