import Emitter from '../shared/emitter.js';
// This import is overwritten by the 'browser' field in package.json with the shimmed version
import JSONStream from 'JSONStream';
import sortKeys from '@momsfriendlydevco/sort-keys';

/**
* Read a JSON stream and emit references
* @see modules/interface.js
*
* @param {Stream} stream Stream primative to encapsulate
*
* @returns {Object} A readable stream analogue defined in `modules/interface.js`
*/
export function readStream(stream) {
	let recNumber = 1;
	let emitter = Emitter();

	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(()=> {
		stream.on('data', ()=> emitter.emit('progress', stream.bytesRead));

		if (typeof stream.pipe === 'function') {
			// On node.js
			const nodeJSONStream = JSONStream.parse('*')
			nodeJSONStream.on('data', ref => emitter.emit('ref', {
					recNumber: recNumber++,
					...ref,
				}))
			nodeJSONStream.on('end', ()=> emitter.emit('end'))
			nodeJSONStream.on('error', emitter.emit.bind('error'));
			stream.pipe(nodeJSONStream)
		}

		else {
			console.error('Error with stream, check "streamEmitter.js" if on browser')
		}
	});

	return emitter;
}


/**
* Write to a stream object
*
* @see modules/interface.js
*
* @param {Steam} [stream] The stream to write to
* @param {Object} [options] Additional options to use when parsing
* @param {String} [options.indent=2] The Indentation option, specify number of space indents or the literal string to indent by (i.e. `\t`)
* @param {String} [options.lineSuffix='\n'] Optional line suffix for each output line of JSON
* @param {Object} [options.sortKeys] Optional options object passed to `sort-keys` to tidy up the output. If omitted the reference is used as is
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream, options) {
	let settings = {
		lineSuffix: '\n',
		indent: 2,
		sortKeys: {
			keys: {
				'recNumber': 1,
				'type': 5,
				'title': 13,
				'journal': 14,
				'authors': 15,
				'isbn': 16,
				'doi': 17,
				'edition': 21,
				'number': 22,
				'pages': 23,
				'language': 70,
				'custom1': 81,
				'custom2': 82,
				'custom3': 83,
				'custom4': 84,
				'custom5': 85,
				'custom6': 86,
				'custom7': 87,
				'researchNotes': 91,
				'notes': 92,
				'abstract': 93,
			},
		},
		...options,
	};

	let lastRef; // Hold last refrence string in memory so we know when we've reached the end (last item shoulnd't have a closing comma)

	return {
		start: ()=> {
			stream.write('[\n');
			return Promise.resolve();
		},
		write: rawRef => {
			let ref = settings.sortKeys ? sortKeys(rawRef, settings.sortKeys) : rawRef;
			if (lastRef) stream.write(lastRef + ',' + settings.lineSuffix); // Flush last reference to disk with comma
			lastRef = JSON.stringify(ref, null, settings.indent);
			return Promise.resolve();
		},
		end: ()=> {
			if (lastRef) stream.write(lastRef + settings.lineSuffix); // Flush final reference to disk without final comma
			stream.write(']');
			return new Promise((resolve, reject) =>
				stream.end(err => err ? reject(err) : resolve())
		);
	},
};
}
