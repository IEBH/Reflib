import {identifyFormat} from './identifyFormat.js';
import {writeStream} from './writeStream.js';

/**
* Prompt the user for a file to save as and Write a given array of citations
*
* @param {Array<ReflibRef>} refs Collection of references to write
*
* @param {Object} [options] Additional options when prompting the user
* @param {String} [options.filename='References.xml'] The filename to download
* @param {Object} [options.writeStreamOptions] Additional options for the subsequent `writeStream` internal call
* @param {Object} [options.promptDownload=true] Prompt the user to save the file, if falsy this returns the Blob file content instead of asking the user where to save it
*
* @returns {Promise|Promise<Blob>} A promise which will resolve when the file download has completed or (if `!promptDownload`) with the blob contents
*/
export function downloadFile(refs, options) {
	let settings = {
		filename: 'References.xml',
		writeStreamOptions: {},
		promptDownload: true,
		...options,
	};

	return Promise.resolve()
		// Identify module from filename {{{
		.then(()=> {
			let module = identifyFormat(settings.filename);
			if (!module) throw new Error(`Unsupported Reflib filename "${settings.filename}"`);
			return module;
		})
		// }}}
		// Create stream {{{
		.then(async (module) => {
			let blobData = [];
			let writableStream = new WritableStream({
				write(chunk) {
					blobData.push(chunk);
				},
			});

			let writer = writableStream.getWriter();

			// Map end->close to keep browser compatibility with Node
			writer.end = async (cb) => {
				await writer.close();
				cb();
			};

			let streamer = await writeStream(module.id, writer, settings.writeStreamOptions);

			return {blobData, streamer};
		})
		// }}}
		// Flush all references into the stream {{{
		.then(async ({blobData, streamer}) => {
			// Start stream
			await streamer.start();

			// Write all references as a promise chain
			await refs.reduce((promiseChain, ref, refIndex, refs) =>
				promiseChain
					.then(()=> streamer.write(ref))
					.then(()=> refIndex < refs.length && streamer.middle && streamer.middle(ref))
			, Promise.resolve());

			// End stream
			await streamer.end();

			return blobData;
		})
		// }}}
		// Convert blobData array to a Blob {{{
		.then(blobData => {
			return new Blob(blobData);
		})
		// }}}
		// Download Blob
		.then(blob => {
			if (!settings.promptDownload) return blob;

			let url = URL.createObjectURL(blob);
			let aEl = document.createElement('a');
			aEl.href = url;
			aEl.download = settings.filename;
			document.body.appendChild(aEl);
			aEl.click();

			// Clean up DOM
			document.body.removeChild(aEl);
			URL.revokeObjectURL(url);
			// }}}
		})
		// }}}
}
