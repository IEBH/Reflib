#!/usr/bin/node

import parseArgs from './shared/parseArgs.js';
import packageInfo from './package.json' with {type: 'json'};
import reflib from './lib/default.js';

let help = `

Usage: reflib -i INPUT_FILE [-f FORMAT] [-o -|OUTPUT_FILE]


-i, --input <file>             Input file to process

-o, --output <file>            Output file to save. Use '-' for STDOUT

-f, --format <reflib-format>   Override or set the file output type (if omitted the outfile filename
                               is used to determine the format)

-v, --verbose                  Be verbose when processing

--version                      Print CLI version and exit

-h, --help                     This help screen
`;

// Parse args {{{
let args = parseArgs.parse();
args = parseArgs.expand(args, {
	'h': 'help',
	'i': 'input',
	'o': 'output',
	'f': 'format',
	'v': 'verbose',
});
args.format ||= 'json';
// }}}

// Action: Version {{{
if (args.version) {
	console.log(`Version: ${packageInfo.version}`);
	process.exit(0);
}
// }}}
// Action: Convert (if --input) {{{
if (args.input) {
	if (args.verbose) console.log('Reading', args.input);
	let refs = await reflib.readFile(args.input);
	if (args.verbose) console.log('Read', refs.length, 'refs');

	if (
		!args.output // No output file specified
		|| args.output == '-' // OR use STDOUT
		|| args.output === true // OR output is just specified as a flag with no rider
	) {
		if (args.verbose) console.log(`Raw output to STDOUT using "${args.format}" format`);

		let stream = reflib.writeStream(
			args.format,
			process.stdout,
			args.format == 'json' ? {indent:'\t'} : {},
		);
		await stream.start();
		await Array.fromAsync(refs, (ref, refIndex) => Promise.resolve()
			.then(()=> stream.write(ref))
			.then(()=> refIndex < refs.length && stream.middle && stream.middle(ref))
		);
		await stream.end();
	} else if (args.output) {
		if (args.verbose) console.log('Writing', args.output);
		await reflib.writeFile(args.output, refs);
	}

	if (args.verbose) console.log('All done');
	process.exit(0);
}
// }}}
// Action: Help {{{
if (args.help) {
	console.log(help);
	process.exit(0);
}
// }}}
// Action: Unknown {{{
console.warn('Nothing to do');
console.log(help);
process.exit(1);
// }}}
