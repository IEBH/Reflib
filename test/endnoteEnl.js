import test, {expect} from '@momsfriendlydevco/testa';
import * as reflib from '../lib/default.js';
import temp from 'temp';
import {writeFile} from 'node:fs/promises';

import config from './config.js';


test('EndnoteXML - should parse an EndNoteENL file').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.enl`))
	.then(refs => {
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(102);
	})
);


test('EndnoteXML - should run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enl'});
	let originalRefs;

	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.enl`))
		.then(refs => {
			expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.log(`SDB file available at ${tempPath}`))
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


test('EndNote ENL - reject a corrupt file instead of resolving with no references').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enl'});
	return Promise.resolve()
		.then(()=> writeFile(tempPath, 'this is not a valid file'))
		.then(()=> reflib.readFile(tempPath))
		.then(
			()=> { throw new Error('readFile should have rejected') },
			e => {
				t.dump(e);
				expect(e).to.be.an.instanceOf(Error);
			},
		)
});

