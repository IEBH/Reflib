import streamEmitter from '../shared/streamEmitter.js';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';


/**
* Build a browser-style ReadableStream from a series of byte chunks
*
* @param {Array<Uint8Array>} chunks Chunks to emit in order
* @returns {ReadableStream} A ReadableStream which emits each chunk then closes
*/
function chunkedStream(chunks) {
	return new ReadableStream({
		start(controller) {
			chunks.forEach(chunk => controller.enqueue(chunk));
			controller.close();
		},
	});
}


/**
* Read a browser-style ReadableStream via the RIS module
*
* @param {ReadableStream} stream The stream to read
* @returns {Promise<Object>} An object of `{refs: Array<Object>, emitter: Object}`
*/
function readRis(stream) {
	return new Promise((resolve, reject) => {
		let refs = [];
		let emitter = streamEmitter(stream);
		reflib.readStream('ris', emitter)
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve({refs, emitter}))
			.on('error', reject);
	});
}


let risBytes = new TextEncoder().encode('TY  - JOUR\nTI  - café naïve\nER  - \n');


test('StreamEmitter - do not lose the first chunk when the consumer subscribes later').do(t => Promise.resolve()
	.then(()=> readRis(chunkedStream([risBytes.slice(0, 5), risBytes.slice(5)])))
	.then(({refs}) => {
		t.dump(refs);
		expect(refs).to.deep.equal([{type: 'journalArticle', title: 'café naïve'}]);
	})
);


test('StreamEmitter - decode multi-byte characters split across chunks').do(t => {
	let cut = risBytes.indexOf(0xC3) + 1; // Split in the middle of the first "é"
	return Promise.resolve()
		.then(()=> readRis(chunkedStream([risBytes.slice(0, cut), risBytes.slice(cut)])))
		.then(({refs}) => {
			t.dump(refs);
			expect(refs).to.deep.equal([{type: 'journalArticle', title: 'café naïve'}]);
		})
});


test('StreamEmitter - count bytes read rather than characters').do(()=> Promise.resolve()
	.then(()=> readRis(chunkedStream([risBytes])))
	.then(({emitter}) => {
		expect(emitter.bytesRead).to.equal(risBytes.byteLength);
	})
);


test('StreamEmitter - pipe all data to a target').do(()=> new Promise((resolve, reject) => {
	let written = '';
	streamEmitter(chunkedStream([risBytes.slice(0, 5), risBytes.slice(5)]))
		.on('error', reject)
		.pipe({
			write(data) { written += data },
			end() {
				expect(written).to.equal('TY  - JOUR\nTI  - café naïve\nER  - \n');
				resolve();
			},
		});
}));
