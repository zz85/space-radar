'use strict'

const fs = require('fs')
const path = require('path')

function explore(dir, level) {
	level = level || 0
	level ++
	let total = 0

	let stat = fs.lstatSync(dir)
	if (stat.isFile())
      total += stat.size
  	else if (stat.isDirectory()) {
  		let files = fs.readdirSync(dir)
  		files.forEach(file => {
  			total += explore(path.join(dir, file), level)
  		})
  	}

  	if (level <= 2) console.log(format(total), dir, level)
  	return total
}


function format(bytes) {
	let kb = bytes / 1024;
	let mb = bytes / 1024 / 1024;
	let gb = bytes / 1024 / 1024 / 1024;
	let tb = bytes / 1024 / 1024 / 1024 / 1024;

	return mb.toFixed(2) + 'MB'
}

console.log(fs, path, format(explore('..')));
