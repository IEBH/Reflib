import {uploadFile} from '../lib/uploadFile.js';
import test, {expect} from '@momsfriendlydevco/testa';

let risContent = 'TY  - JOUR\nTI  - Uploaded title\nAU  - Smith, J.\nER  - \n';


/**
* Install a minimal fake DOM so the upload prompt path of uploadFile() can run under Node
* The fake file input immediately "selects" the given file when clicked
*
* @param {File} file The file the fake picker should return
* @returns {Function} Function to call to restore the globals
*/
function stubDom(file) {
	let listeners = {};
	let element = {
		style: {},
		addEventListener(event, cb) { listeners[event] = cb },
		appendChild() {},
		dispatchEvent() { setTimeout(()=> listeners.change({target: {files: [file]}})) },
	};

	let previous = {document: globalThis.document, MouseEvent: globalThis.MouseEvent};
	globalThis.document = {
		createElement: ()=> element,
		body: {appendChild() {}, removeChild() {}},
	};
	globalThis.MouseEvent = class {};

	return ()=> Object.assign(globalThis, previous);
}


test('uploadFile - read a given File via the browser stream path').do(t => Promise.resolve()
	.then(()=> uploadFile({file: new File([risContent], 'refs.ris')}))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.deep.equal([{type: 'journalArticle', title: 'Uploaded title', authors: ['Smith, J.']}]);
	})
);


test('uploadFile - use the picked file even when options.file is explicitly undefined').timeout('5s').do(t => {
	let restore = stubDom(new File([risContent], 'refs.ris'));
	let started;

	return Promise.resolve()
		.then(()=> uploadFile({
			file: undefined,
			onStart: file => started = file,
		}))
		.then(refs => {
			t.dump(refs);
			expect(started).to.be.an.instanceOf(File);
			expect(refs).to.have.length(1);
			expect(refs[0]).to.have.property('title', 'Uploaded title');
		})
		.finally(restore)
});
