import {formats} from './formats.js';
import {identifyFormat} from './identifyFormat.js';
import {readStream} from './readStream.js';
import StreamEmitter from '../shared/streamEmitter.js';

/**
* Prompt the user for a file then read it as a Reflib event emitter
* @param {Object} [options] Additional options when prompting the user
* @param {File} [options.file] The File object to process, omitting this will prompt the user to select a file
* @param {function} [options.onStart] Async function called as `(File)` when starting the read stage
* @param {function} [options.onProgress] Function called as `(position, totalSize, refCount)` when processing the file
* @param {function} [options.onEnd] Async function called as `()` when the read stage has completed
* @param {...*} [options...] Additional settings to pass to `readStream()`
* @returns {Promise} A promise which will resolve with an array of extracted citations
*/
export function uploadFile(options) {
	let settings = {...options};

	if (!settings.file) { // No file provided - prompt the user via the DOM
		// Horrible kludge to create an upload element in the DOM + interact with it {{{
		return new Promise(resolve => {
			// Create hidden layer we will use to wrap the actual file upload input box
			let fileWrapper = document.createElement('div');
			fileWrapper.style.display = 'none';
			document.body.appendChild(fileWrapper);

			// Create upload input
			let uploader = document.createElement('input');
			uploader.type = 'file';
			uploader.accept = Object.values(formats) // Allow only uploading supported file extensions
				.flatMap(f => f.ext)
				.join(',');

			uploader.addEventListener('change', e => {
				document.body.removeChild(fileWrapper);
				resolve(uploadFile({
					...options,
					file: e.target.files[0], // Always use the file the user picked, even if `options.file` was explicitly undefined
				}));
			});
			fileWrapper.appendChild(uploader);
			uploader.dispatchEvent(new MouseEvent('click'));
		});
		// }}}
	} else { // Read the File object and return an emitter
		if (!(settings.file instanceof File)) throw new Error('Expected "file" setting to uploadFile() to be a File type');
		let identifiedType = identifyFormat(settings.file.name);
		if (!identifiedType) throw new Error(`Unidenfified file format from filename "${settings.file.name}"`);

		let refs = [];
		return Promise.resolve()
			.then(()=> settings.onStart && settings.onStart(settings.file))
			.then(()=> new Promise((resolve, reject) => {
				let streamer = readStream(
					identifiedType.id,
					StreamEmitter(settings.file.stream()),
					{
						...settings,
						size: settings.file.size,
					},
				)
					.on('end', ()=> resolve(refs))
					.on('error', e => reject(e))
					.on('ref', ref => refs.push(ref))

				if (settings.onProgress) streamer.on('progress', settings.onProgress);
			}))
			.then(()=> settings.onEnd && settings.onEnd())
			.then(()=> refs)
	}
}
