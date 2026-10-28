import Emitter from '../shared/emitter.js';

/**
* Wrapper for streams which transforms a given input into an emitter pattern
* This is designed to let regular `node:stream.Readable` objects pass through without alteration but browser based stream objects get wrapped
* @param {stream.Readable|ReadableStream} inStream The input stream to wrap
* @returns {stream.Readable|Emitter} Either the unedited node compatible stream or an event emitter with the same behaviour
*
* @emits data Emitted as `(chunk)` on each data chunk
* @emits end Emitted as `()` when the input stream has closed
* @emits error Emitted as `(Error)` on any read error
*/
export default function streamEmitter (inStream) {
	if (inStream.getReader) { // Assume browser compatible ReadableStream
		/**
		* MC's tiny ReadableStream -> stream.Readable / Emitter pattern
		* There is a non-zero chance that this is going to break at some future point
		* This is really just a shiv for browser functionality to replicate Stream-a-like emitter pattern
		* @date 2023-10-19
		* @author Matt Carter <m@ttcarter.com>
		*/
		let reader = new Emitter();
		let emitterOn = reader.on; // Original (chainable) subscribe function
		let started = false;

		/**
		* Begin reading on the next tick
		* This is deferred until a consumer subscribes (via `on()` or `pipe()`) so the first chunk is never emitted before anyone is listening
		*/
		let start = ()=> {
			if (started) return;
			started = true;
			setTimeout(()=> reader.read());
		};

		/**
		* Emit a decoded chunk of text to subscribers + any pipe target
		* @param {String} data The decoded text to emit
		*/
		let emitData = data => {
			if (!data) return;
			reader.emit('data', data);
			if (reader.pipeTarget) reader.pipeTarget.write(data);
		};

		Object.assign(reader, {
			isBrowser: true, // Tells us we are in browser env
			bytesRead: 0,
			reader: inStream.getReader(),
			textDecoder: new TextDecoder('utf-8'),
			on(...args) {
				emitterOn(...args);
				start();
				return reader;
			},
			read() { // Read one chunk + trigger emitters
				this.reader.read()
					.then(({done, value}) => {
						if (done) {
							emitData(this.textDecoder.decode()); // Flush any trailing partial character
							reader.emit('end');

							if (this.pipeTarget)
								this.pipeTarget.end();
						} else if (value) {
							this.bytesRead += value.byteLength;
							emitData(this.textDecoder.decode(value, {stream: true})); // Stream mode so multi-byte characters split across chunks decode correctly

							setTimeout(this.read.bind(this));
						}
					})
					.catch(e => reader.emit('error', e))
			},
			pipeTarget: null,
			pipe(target) {
				this.pipeTarget = target;
				start();
				return this;
			},
		});

		return reader;
	} else { // Assume Node native stream.Readable
		return inStream;
	}
}
