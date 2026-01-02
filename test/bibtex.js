import {readFile} from 'node:fs/promises';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';
import temp from 'temp';

import config from './config.js';


test.skip('BibTeX - should parse a file').timeout('30s').do(t => Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.bib`))
	.then(refs => {
		t.dump(refs);
		bibtexRefs = refs;
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(102);
	})
);


test('BibTeX - output a file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.bib'});
	let originalRefs;

	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.enlx`))
		.then(refs => {
			// expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.log(`BibTeX file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> readFile(tempPath, 'utf8'))
		.then(contents => {
			console.log('RAW FILE:', contents);

			expect(contents).to.match(/@Article\{910,/sm);

			let ref = /@Article{910,.*?$}/sm.exec(contents); // Pick a random ref output to examine
			expect(ref).to.match(/@Article\{910,/sm);
			expect(ref).to.match(/^title=\{Recent advances.+therapy\},$/sm);
			expect(ref).to.match(/^author=\{Das, S\..+R\. V\.\},$/sm);
			expect(ref).to.match(/^volume=\{15\}$/sm);
			expect(ref).to.match(/^number=\{6\}$/sm);
			expect(ref).to.match(/^pages=\{479.88\}$/sm);
			expect(ref).to.match(/^abstract=\{Acne pathogenesis.+\},$/sm);
			expect(ref).to.match(/^language=\{eng\}$/);
		})
});
