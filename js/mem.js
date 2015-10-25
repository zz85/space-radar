'use strict'
// memory usage

let CMD = 'ps -cxm -opid,ppid,rss,comm'
let child_process = require('child_process')


function process_out(stdout) {
	// var lines = stdout.split("\n");
	var regex = /^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/mg

	var m;

	var c = 0, rss_sum = 0
	var pid, ppid, rss, comm, process
	var all = {}
	while (m = regex.exec(stdout)) {
		pid = +m[1]
		ppid = +m[2]
		rss = +m[3] * 1024
		comm = m[4]

		c++
		rss_sum += rss

		process = {
			pid: pid,
			ppid: ppid,
			rss: rss,
			comm: comm
		}

		all[pid] = process

		// console.log(c, pid, ppid, rss, comm)
	}

	var top = {
		name: 'root',
		children: []
	}

	let sorted = Object.keys(all).map(k => { return all[k] })
	.sort((a, b) => { return a.pid - b.pid})
	.forEach(a => {
		// console.log(a.pid)
		let parent
		if (a.ppid in all) {
			parent = all[a.ppid]
		} else {
			// console.log('top level', a)
			parent = top
		}


		if (!parent.children) {
			parent.children = []
			parent.children.push({
				name: parent.name,
				size: parent.size,
				parent: 1
			})
			delete parent.size
		}
		parent.children.push(a)

		// cleanup
		a.name = a.comm + ' (' + a.pid + ')'
		a.size = a.rss
		delete a.comm
		delete a.pid
		delete a.rss
		delete a.ppid

	})

	console.log(top)
	console.log('rss_sum', rss_sum)
	return top
}

function mem(callback) {
	let ps = child_process.exec(CMD, (error, stdout, stderr) => {
		if (error) return console.error(error)
		var ps = process_out(stdout)
		callback(ps)
	})

}