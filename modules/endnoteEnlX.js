import * as EndNoteEnl from './endnoteEnl.js';
import Emitter from '../shared/emitter.js';
import {BlobReader as ZipBlobReader, ZipReader, Writer} from '@zip.js/zip.js';

/**
* Utility class to read a Zip file into a Uint8Array
* This extends the deafult @zip.js/zip.js Writer class so its works without a crowbar
*/
class BinaryStringWriter extends Writer {
	chunks = [];

	writeUint8Array(chunk) {
		this.chunks.push(chunk);
	}

	getData() {
		let buf = new Uint8Array(
			this.chunks.reduce((total, chunk) => total + chunk.length, 0)
		);

		let position = 0;
		this.chunks.forEach(chunk => {
			buf.set(chunk, position);
			position += chunk.length;
		});

		// Flush buffer to free up memory
		this.chunks = [];

		return buf;
	}
}


/**
* Read an EndNote(@11+) / Zip+SQLite database EnlX returning an Emitter analogue
*
* Since EnlX files are really just a Zip file containing the SQLite database we're actually intrestesd in, most of this module
* is handling the Zip container and handing the extracted buffer to the regular modules/endnoteEnl.js driver
*
* @see modules/inhterface.js
*
* @param {Stream} stream Stream primative to encapsulate
*
* @returns {Object} An Emitter analogue defined in `../shared/Emitter.js`
*/
export function readStream(stream) {
	let emitter = Emitter();

	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(()=> {
		let chunks = []; // Gathered buffer chunks, used to make an arrayBuffer later

		stream
			.on('data', chunk => chunks.push(chunk))
			.on('error', e => emitter.emit('error', e))
			.on('end', ()=> {
				Promise.resolve()
					.then(()=> { // Parse chunks into a Blob
						let blob = new Blob(chunks);

						// Release chunks to free up memory
						chunks = [];
						return blob;
					})
					.then(blob => new ZipReader( // Create zipReader
						new ZipBlobReader(blob),
					))
					.then(zip => zip.getEntries()) // Fetch files
					.then(files => files.find(f => f.filename == 'sdb/sdb.eni')) // Find the file we want
					.then(sdb => { // Extract that files stream
						if (!sdb) throw new Error('EnlX file does not contain an "sdb/sdb.eni" database');
						let writer = new BinaryStringWriter();
						return sdb.getData(writer);
					})
					.then(buf => EndNoteEnl.readBuffer(buf, {
						onRef(ref) {
							emitter.emit('ref', ref);
						},
					}))
					.then(()=> emitter.emit('end'))
					.catch(e => emitter.emit('error', e))
			})
	});

	return emitter;
}
