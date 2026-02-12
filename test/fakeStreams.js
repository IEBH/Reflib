import {Readable, Writable} from 'node:stream';


/**
* Wrapper to provide a ReadableStream type from a simple string input
* This is intended for testkit purposes only
*
* @param {String} content The input content to streamify
* @returns {ReadableStream} A compatible ReadableStream
*
* @example Write to Reflib using a fake ReadStream
* await new Promise((resolve, reject) => {
* 	let refs = [];
*
* 	reflib.readStream('bibtex', fakeStreams.readStream(`
* 	@article{FakeKey123,
* 	   title = {A fake title},
*        year = {2026}
* 	}
* 	`))
* 		.on('ref', ref => refs.push(ref))
* 		.on('end', ()=> resolve(refs))
* 		.on('error', reject);
* })
*/
export function readStream(content) {
	return Readable.from(content);
}



/**
* Return a Reflib compatiible WriteStream object which will return its buffered string contents on `.end()`
*
* @returns {Object} A Reflib compatible WriteStream-a-like
*
* @example Write with Reflib using a fake WriteStream
* let fakeWriter = fakeStreams.writeStream();
* let stream = reflib.writeStream('bibtex', fakeWriter);
* stream.start();
* refs.forEach(ref =>
* 	stream.write(ref)
* );
* await stream.end()
* let contents = fakeWriter.contents());
*/
export function writeStream() {
	let chunks = [];

	let stream = new Writable({
		write(chunk, encoding, callback) {
			chunks.push(chunk);
			callback();
		}
	});

	stream.contents = function() {
		return Buffer.concat(chunks).toString();
	};

	return stream;
}


export default {
	readStream,
	writeStream,
}
