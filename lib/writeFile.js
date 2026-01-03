import {createWriteStream} from 'node:fs';
import {finished as streamFinished} from 'node:stream/promises';
import {identifyFormat} from './identifyFormat.js';
import {writeStream} from './writeStream.js';

/**
* Write a file to disk via the appropriate module
*
* @param {string} path The file path to write, the module to use will be determined from this
* @param {Array<ReflibRef>} refs Collection of references to write
* @param {Object} [options] Additional options to pass to the file writer
* @param {string} [options.module] The module to use if overriding from the file path
*
* @returns {Promise} A promise which resolves when the operation has completed
*/
export function writeFile(path, refs, options) {
	let format = options?.module || identifyFormat(path)?.id;
	if (!format) throw new Error(`Unable to identify reference library format when saving file "${path}"`);

	let fileStream = createWriteStream(path);
	let writer = writeStream(format, fileStream, options);

	return Promise.resolve()
		.then(()=> writer.start())
		.then(()=> refs.reduce((chain, ref, refIndex, refs) => chain // Write all refs as a series of promises
			.then(()=> writer.write(ref))
			.then(()=> refIndex < refs.length && writer.middle && writer.middle(ref))
		, Promise.resolve()))
		.then(()=> writer.end())
		.then(()=> fileStream.close())
		.then(()=> streamFinished(fileStream))
}
