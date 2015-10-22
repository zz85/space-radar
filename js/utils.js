'use strict'

function format(bytes) {
	let kb = bytes / 1024;
	let mb = bytes / 1024 / 1024;
	let gb = bytes / 1024 / 1024 / 1024;
	let tb = bytes / 1024 / 1024 / 1024 / 1024;

	var units = {
		KB: kb,
		MB: mb,
		GB: gb,
		TB: tb,
	};

	var last_unit = 'B';
	var last_value = bytes;
	for (var u in units) {
		if (units[u] < 1) {
			return last_value + ' ' + last_unit
		}
		last_unit = u;
		last_value = units[u].toFixed(2);
	}
	return last_value + ' ' + last_unit
}

if (window) {
	window.format = format;
}
