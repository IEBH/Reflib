import test, {expect} from '@momsfriendlydevco/testa';
import * as reflib from '../lib/default.js';
import fspath from 'node:path';
import temp from 'temp';

let __dirname = fspath.resolve(fspath.dirname(decodeURI(new URL(import.meta.url).pathname)));

test('EndnoteX - should parse an EndNoteX file').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${__dirname}/data/blue-light.enlx`))
	.then(refs => {
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(102);
	})
);

test.skip('should run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	this.timeout(60 * 1000); //= 1m

	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enlx'});
	let originalRefs;
	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${__dirname}/data/blue-light.enlx`))
		.then(refs => {
			expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.log(`EnlX file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.stage('Comparing', newRefs.length, 'references');
			expect(newRefs).to.have.length(originalRefs.length);
			newRefs.forEach((ref, refOffset) =>
				expect(ref).to.deep.equal(originalRefs[refOffset])
			);
		})
});
