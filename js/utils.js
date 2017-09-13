'use strict'

function format(bytes) {
  let kb = bytes / 1024
  let mb = bytes / 1024 / 1024
  let gb = bytes / 1024 / 1024 / 1024
  let tb = bytes / 1024 / 1024 / 1024 / 1024

  var units = {
    KB: kb,
    MB: mb,
    GB: gb,
    TB: tb
  }

  var last_unit = 'B'
  var last_value = bytes
  for (var u in units) {
    if (units[u] < 1) {
      return last_value + ' ' + last_unit
    }
    last_unit = u
    last_value = units[u].toFixed(2)
  }
  return last_value + ' ' + last_unit
}

function clone(json) {
  return JSON.parse(JSON.stringify(json))
}

function clone2(source, target) {
  if (!target) target = {}

  if (source.name) target.name = source.name
  if (source.size) target.size = source.size
  if (source.children) {
    target.children = []
    source.children.forEach(node => {
      target.children.push(clone2(node, {}))
    })
  }

  return target
}

let last_time = new Date()
log('loaded')

function fmt_time(ms) {
  let s = ms / 1000
  let m = s / 60

  if (s < 10) {
    return ms + 'ms'
  }
  if (m < 1) {
    return s.toFixed(2) + 's'
  }

  s = (s % 60) | 0
  s = s == 0 ? '00' : s > 10 ? s : '0' + s
  return (m | 0) + ':' + s + 'm'
}
function log() {
  let now = new Date()

  var args = Array.prototype.slice.call(arguments)

  var fmt = args.map(a => {
    switch (typeof a) {
      case 'number':
        return '%f'
      case 'string':
      case 'boolean':
        return '%s'
      case 'object':
      default:
        return '%o'
    }
  })
  args.unshift(
    '%c ' + /\d\d\:\d\d\:\d\d/.exec(now)[0] + '  +' + fmt_time(now - last_time) + '\t' + fmt.join(' '),
    'background: #222; color: #bada55'
  )
  if (!CHROME) {
    args = args.slice(2)
    args.unshift(fmt_time(now - last_time) + '\t')
  }
  last_time = now
  console.log.apply(console, args)
}

function memory() {
  gc()

  var mem = performance.memory

  log(
    'limit',
    (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
    'heap total',
    (mem.totalJSHeapSize / 1024 / 1024).toFixed(2),
    'heap used',
    (mem.usedJSHeapSize / 1024 / 1024).toFixed(2)
  )
}

/*
 * An abstraction that runs a task in the future
 * if a task is scheduled before it's ran,
 * the previous task would be cancelled
 */
function TimeoutTask(task, time) {
  this.id = null
  this.task = task
  this.time = time
}

TimeoutTask.prototype.cancel = function() {
  this.id = clearTimeout(this.id)
}

TimeoutTask.prototype.schedule = function(t) {
  this.time = t !== undefined ? t : this.time
  this.cancel()
  this.id = setTimeout(this.run.bind(this), this.time)
}

TimeoutTask.prototype.run = function() {
  this.cancel()
  if (this.task) this.task(this.schedule.bind(this))
}

/*
 * An abstraction Timer Task that runs
 * in a RAF fashion
 */
function TimeoutRAFTask(task, onrun) {
  this.id = null
  this.task = task
  if (onrun) this.onrun = onrun
}

TimeoutRAFTask.prototype.cancel = function() {
  if (this.id) {
    this.id = cancelAnimationFrame(this.id)
  }
}

TimeoutRAFTask.prototype.run = function() {
  if (this.task) {
    var self = this
    this.cancel()
    this.task(function() {
      self.id = requestAnimationFrame(self.run.bind(self))
    })
  }
}

/*
 * Alternative task runner that runs
 * during polled interval checks
 */

function TaskChecker(task, time) {
  this.running = false
  this.task = task
  this.time = time
  this.scheduled = Date.now() + time
}

TaskChecker.prototype.cancel = function() {
  this.running = false
}

TaskChecker.prototype.schedule = function(t) {
  this.running = true
  this.time = t !== undefined ? t : this.time
  this.scheduled = Date.now() + this.time
}

TaskChecker.prototype.run = function() {
  if (this.task) this.task(this.schedule.bind(this))
}

TaskChecker.prototype.check = function() {
  if (!this.running) return

  var now = Date.now()
  var diff = now - this.scheduled

  if (diff >= 0) {
    this.run()
  }
}

var mempoller = new TimeoutTask(function(next) {
  hidePrompt()

  mem(function(err, ps) {
    // log('mem polled')
    onJson(null, ps)
    next()
  })
}, 15000)

var CHROME = typeof window !== 'undefined'

if (typeof module !== 'undefined') {
  module.exports = {
    format: format,
    log: log,
    TimeoutTask: TimeoutTask,
    TaskChecker: TaskChecker
  }
}

// if (window) {
// 	window.format = format
// 	window.clone2 = clone
// 	window.log = log
// 	window.memory = memory
// }
