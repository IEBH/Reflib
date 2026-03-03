/**
* Attempt to parse an process.argv like array into extracted flags and their values
*
* Supported:
*     `--flag` → `true`
*     `--flag val` → `'val'`
*     `--flag a b c` → `['a', 'b', 'c']` (variadic, stops at next flag)
*     `-f` → `true`
*     `-abc` → `{ a: true, b: true, c: true }`
*     `-n 1 2 3` → `{ n: ['1', '2', '3'] }` (last short flag is variadic)
*     `--` → remaining args go to `_`
*     Bare positional args → `_` array
*
* @param {Array<String>} [argv=process.argv] `argv` like array to parse, If omitted `process.argv.slice(2)` is used
* @returns {Object} An object with extracted flags
*
* @example Basic argv example
* parseArgs([
*   '--name', 'Alice', 'Bob', '--verbose', '-n', '42', '-xvf', 'file1', 'file2',
* ]) //= {
*   _: [],
*   name: ['Alice', 'Bob'],
*   verbose: true,
*   	n: '42',
*   	x: true,
*   	v: true,
*   	f: ['file1', 'file2']
*   }
*/
export function parse(argv = process.argv.slice(2)) {
	let result = { _: [] }
	let i = 0

	let collectValues = (args, start) => {
		let values = []
		let j = start
		while (j < args.length && !args[j].startsWith('-')) {
			values.push(args[j++])
		}
		return { values, next: j }
	}

	while (i < argv.length) {
		let arg = argv[i]

		if (arg.startsWith('--')) {
			let key = arg.slice(2)
			if (!key) { i++; break } // -- separator
			let { values, next } = collectValues(argv, i + 1)
			result[key] = values.length === 0 ? true
				: values.length === 1 ? values[0]
				: values
			i = next
		} else if (arg.startsWith('-')) {
			let flags = arg.slice(1)
			// Check if last char is the one collecting values
			for (let f = 0; f < flags.length - 1; f++) {
				result[flags[f]] = true
			}
			let lastFlag = flags.at(-1);
			let { values, next } = collectValues(argv, i + 1);
			result[lastFlag] = values.length === 0 ? true
				: values.length === 1 ? values[0]
				: values
			i = next;
		} else {
			result._.push(arg)
			i++
		}
	}

	// Remaining after -- go to _
	while (i < argv.length) result._.push(argv[i++])

	return result
}


/**
* Accept a parsed args object and expand short-flags into long-flags
*
* @param {Object} args Parsed arg object to process
* @param {Object} argMap Object of `shortFlag:String => longFlag:String` translations to apply
*
* @returns {Object} The input `args` object with all short-flags translated to long-flags
*/
export function expand(args, argMap) {
	let outArgs = {...args}; // Shallow copy of incoming args object we are going to mutate

	Object.entries(argMap)
		.filter(([shortFlag]) => args[shortFlag])
		.map(([shortFlag, longFlag]) => {
			outArgs[longFlag] = outArgs[shortFlag];
			delete outArgs[shortFlag];
		});

	return outArgs;
}


export default {
	expand,
	parse,
}
