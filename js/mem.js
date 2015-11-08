'use strict'
// memory usage

let CMD = 'ps -cx -opid,ppid,rss,comm'
// -m sort by memory
// -c use short process name
// -x extended (other users)
let child_process = require('child_process')
let VM_STAT = 'vm_stat'

function stat(out) {
	var r = /page size of (\d+)/.exec(out)
	var page_size = +r[1]

	var m;

	var page_reg = /Pages\s+([^:]+)[^\d]+(\d+)/g

	var vm_stat = {}

	while (m = page_reg.exec(out)) {
		// console.log(m[1], m[2] * page_size / 1024 / 1024)
		vm_stat[m[1]] = m[2] * page_size
	}

	return vm_stat
}

function process_out(stdout) {
	// log(stdout)
	// var lines = stdout.split("\n");
	var regex = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/mg
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

		// log(c, pid, ppid, rss, comm)
	}

	var app = {
		name: 'App Memory',
		children: []
	}

	let sorted = Object.keys(all).map(k => { return all[k] })
	.sort((a, b) => { return a.pid - b.pid})
	.forEach(a => {
		let parent
		if (a.ppid in all) {
			parent = all[a.ppid]
		} else {
			// console.log('top level', a)
			parent = app
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

	// console.log(app)
	// console.log('rss_sum', rss_sum)
	return {
		app: app,
		sum: rss_sum,
		count: c
	}

}

function mem(callback) {

	let vm_stat

	child_process.exec(VM_STAT, (error, stdout, stderr) => {
		if (error) {
			callback(error)
			return console.error(error)
		}

		vm_stat = stat(stdout)

		child_process.exec(CMD, ps)
	})

	let ps = (error, stdout, stderr) => {
		if (error) {
			callback(error)
			return console.error(error)
		}
		let app = process_out(stdout)

		let top = combine(app, vm_stat)

		callback(null, top)
	}
}
/*
free 1782.23046875
active 3630.9453125
inactive 969.33984375
speculative 181.41015625
throttled 0
wired down 1127.02734375
purgeable 655.8984375
copy-on-write 77013.4921875
zero filled 2738058.21484375
reactivated 449955.0703125
purged 607598.33203125
stored in compressor 2739.4296875
occupied by compressor 499.375
*/

function combine(app, vm_stat) {
	var top = {
		name: 'Memory',
		children: [
		]
	}

	var diff = vm_stat.active - app.sum
	var active = {
		name: 'Active Memory',
		children: [app.app]
	}

	top.children.push(active)

	// app.app
	active
	.children.push({
		name: 'Kernel / others?',
		size: diff
	})

	;['free',  'inactive', 'speculative', 'wired down', 'occupied by compressor']
	//, 'purgeable', 'stored in compressor', 'active',
	.forEach(
		function(n) {
			top.children.push(
				{
					name: n,
					size: vm_stat[n]
				}
			)
		}
	)

	return top


}