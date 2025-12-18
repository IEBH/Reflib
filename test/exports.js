import test, {expect} from '@momsfriendlydevco/testa';
import {identifyFormat, formats, getModule, readFile, readStream, writeFile, writeStream,getRefDoi} from '../lib/default.js';

test('Library has exported functions', ()=> {
	expect(identifyFormat).to.be.a('function');
	expect(getModule).to.be.a('function');
	expect(readFile).to.be.a('function');
	expect(readStream).to.be.a('function');
	expect(writeFile).to.be.a('function');
	expect(writeStream).to.be.a('function');
	expect(getRefDoi).to.be.a('function');
});

test('Library should correctly have exported objects', ()=> {
	expect(formats).to.be.a('object');
});
