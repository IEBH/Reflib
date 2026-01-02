import {readFile} from 'node:fs/promises';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';
import temp from 'temp';

import config from './config.js';


test('BibTeX - should parse a file').timeout('30s').do(t => Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.bib`))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.be.an('array');
		// expect(refs).to.have.length(102); // FIXME: .bib field mismatches with actual ref file
		return refs;
	})
	.then(refs => { // Pick a random ref to interrogate
		let ref = refs.find(ref => ref.recNumber == 910);
		t.dump(ref);
		expect(ref).to.be.an('object');

		expect(ref).to.have.property('title', 'Recent advances in acne pathogenesis: implications for therapy');
		expect(ref).to.have.property('journal', 'Am J Clin Dermatol');
		// Omitted: year
		expect(ref).to.have.property('volume', '15');
		expect(ref).to.have.property('number', '6');
		expect(ref).to.have.property('issn', '1175-0561');
		expect(ref).to.have.property('doi', '10.1007/s40257-014-0099-z');
		expect(ref).to.have.property('language', 'eng');

		expect(ref).to.have.property('pages');
		expect(ref.pages).to.match(/^479.88$/);

		expect(ref).to.have.property('abstract');
		expect(ref.abstract).to.match(/^Acne pathogenesis.+outcomes\.$/);

		expect(ref).to.have.property('notes');
		expect(ref.notes).to.match(/^1179-1888.+s40257-014-0099-z\.$/);

		expect(ref).to.have.property('authors');
		expect(ref.authors).to.be.an('array');
		expect(ref.authors).to.deep.equal([
			'Das, S.',
			'Reynolds, R. V.',
		]);

		expect(ref).to.have.property('keywords');
		expect(ref.keywords).to.be.an('array');
		/* FIXME: Not sure if this is right or wrong
		expect(ref.keywords).to.deep.equal([
			'Acne Vulgaris',
			'drug therapy/microbiology/pathology Administration, Cutaneous Anti-Bacterial Agents/administration & dosage',
			'therapeutic use Dermatologic Agents/administration & dosage',
			'therapeutic use Drug Therapy, Combination Humans Immunity, Innate Photochemotherapy/methods Propionibacterium acnes/isolation & purification',
		]);
		*/

		expect(ref).to.have.property('urls');
		expect(ref.urls).to.be.an('array');
		expect(ref.urls).to.deep.equal([
			'https://doi.org/10.1007/s40257-014-0099-z',
		]);
	})
);


test('BibTeX - output a file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.bib'});
	let originalRefs;

	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
		.then(refs => {
			expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.log(`BibTeX file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> readFile(tempPath, 'utf8'))
		.then(contents => {
			expect(contents).to.match(/@Article\{910,/sm);

			let ref = /@Article{910,.*?^}/sm.exec(contents)?.[0]; // Pick a random ref output to examine
			console.log('RAW REF', '[[[', ref, ']]]');
			expect(ref).to.match(/@Article\{910,/sm);
			expect(ref).to.match(/^title=\{Recent advances.+therapy\}/sm);
			expect(ref).to.match(/^author=\{Das, S\..+R\. V\.\}/sm);
			expect(ref).to.match(/^volume=\{15\}/sm);
			expect(ref).to.match(/^number=\{6\}/sm);
			expect(ref).to.match(/^pages=\{479.88\}/sm);
			expect(ref).to.match(/^abstract=\{Acne pathogenesis.+\}/sm);
			expect(ref).to.match(/^language=\{eng\}/);
		})
});
