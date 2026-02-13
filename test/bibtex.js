import fakeStreams from './fakeStreams.js';
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
		expect(refs).to.have.length(102); // FIXME: .bib field mismatches with actual ref file
		return refs;
	})
	.then(refs => { // Pick a random ref to interrogate
		let ref = refs.find(ref => ref.recNumber == 3);
		t.dump(ref);
		expect(ref).to.be.an('object');

		expect(ref).to.have.property('title', 'Recent advances in acne pathogenesis: implications for therapy');
		expect(ref).to.have.property('journal', 'Am J Clin Dermatol');
		expect(ref).to.have.property('type', 'journalArticle');
		// Omitted: year
		expect(ref).to.have.property('volume', '15');
		expect(ref).to.have.property('number', '6');
		expect(ref).to.have.property('isbn', '1175-0561');
		expect(ref).to.have.property('doi', '10.1007/s40257-014-0099-z');

		expect(ref).to.have.property('pages');
		expect(ref.pages).to.match(/^479.88$/);

		expect(ref).to.have.property('authors');
		expect(ref.authors).to.be.an('array');
		expect(ref.authors).to.deep.equal([
			'Das, S.',
			'Reynolds, R. V.',
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
		.then(()=> t.log(`BibTeX output file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> readFile(tempPath, 'utf8'))
		.then(contents => {
			expect(contents).to.match(/@Article\{RN910,/sm);

			let ref = /@Article{RN910,.*?^}/sm.exec(contents)?.[0]; // Pick a random ref output to examine
			t.dump({ref910: ref});
			expect(ref).to.match(/@Article\{RN910,/sm);
			expect(ref).to.match(/^title=\{Recent advances.+therapy\}/sm);
			expect(ref).to.match(/^author=\{Das, S\..+R\. V\.\}/sm);
			expect(ref).to.match(/^volume=\{15\}/sm);
			expect(ref).to.match(/^number=\{6\}/sm);
			expect(ref).to.match(/^pages=\{479.88\}/sm);
			expect(ref).to.match(/^abstract=\{Acne pathogenesis.+\}/sm);
			expect(ref).to.match(/^language=\{eng\}/sm);
		})
});


test('BibTeX - preserve citation keys').do(t => Promise.resolve()
	.then(()=> t.stage('Read simple citations with custom key'))
	.then(()=> new Promise((resolve, reject) => {
		let refs = [];

		reflib.readStream('bibtex', fakeStreams.readStream(`
		@article{FakeKey123,
		   title = {A fake title},
           year = {2026}
		}
		`))
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve(refs))
			.on('error', reject);
	}))
	.then(refs => {
		t.stage('Check citations have been parsed');
		t.dump(refs);
		expect(refs).to.deep.equal([{
			key: 'FakeKey123',
			title: 'A fake title',
			type: 'journalArticle',
			year: '2026',
		}]);

		return refs;
	})
	.then(refs => {
		t.stage('Write back citations');
		let fakeWriter = fakeStreams.writeStream();
		let stream = reflib.writeStream('bibtex', fakeWriter);
		stream.start();
		refs.forEach(ref =>
			stream.write(ref)
		);
		return stream.end()
			.then(()=> fakeWriter.contents());
	})
	.then(buffer => buffer.trimEnd())
	.then(buffer => {
		t.stage('Check written citations')
		let expectedBuffer = [
			'@Article{FakeKey123,',
			'title={A fake title},',
			'year={2026}',
			'}',
		].join('\n');
		t.dump({
			'expected': expectedBuffer.split(/\n/),
			'got_____': buffer.split(/\n/),
		});
		expect(buffer).to.deep.equal(expectedBuffer);
	})

);
