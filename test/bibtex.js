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


test('BibTeX - preserve citation keys + custom fields').do(t => Promise.resolve()
	.then(()=> t.stage('Read simple citations with custom key'))
	.then(()=> new Promise((resolve, reject) => {
		let refs = [];

		reflib.readStream('bibtex', fakeStreams.readStream(`
		@article{FakeKey123,
		   title = {A fake title},
           year = {2026},
           foo = {123},
           bar = {Hello world}
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
			foo: '123',
			bar: 'Hello world',
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
		let gotBuffer = buffer.split(/\n/);
		let expectedBuffer = [
			'@Article{FakeKey123,',
			'title={A fake title},',
			'year={2026},',
			'foo={123},',
			'bar={Hello world}',
			'}',
		];
		t.dump({
			'expected': expectedBuffer,
			'got_____': gotBuffer,
		});
		expect(gotBuffer).to.deep.equal(expectedBuffer);
	})

);


/**
* Read a BibTeX string via the stream reader
*
* @param {String} content BibTeX content to parse
* @param {Object} [options] Options to pass to the reader
* @returns {Promise<Array<Object>>} The parsed references
*/
function readBibtex(content, options) {
	return new Promise((resolve, reject) => {
		let refs = [];
		reflib.readStream('bibtex', fakeStreams.readStream(content), options)
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve(refs))
			.on('error', reject);
	});
}


/**
* Write references to a BibTeX string via the stream writer
*
* @param {Array<Object>} refs References to write
* @param {Object} [options] Options to pass to the writer
* @returns {Promise<String>} The written BibTeX content
*/
function writeBibtex(refs, options) {
	let fakeWriter = fakeStreams.writeStream();
	let stream = reflib.writeStream('bibtex', fakeWriter, options);
	return Promise.resolve()
		.then(()=> stream.start())
		.then(()=> refs.reduce((chain, ref, refIndex) => chain
			.then(()=> stream.write(ref))
			.then(()=> refIndex < refs.length - 1 && stream.middle(ref))
		, Promise.resolve()))
		.then(()=> stream.end())
		.then(()=> fakeWriter.contents());
}


test('BibTeX - skip comments and text before entries').do(t => Promise.resolve()
	.then(()=> readBibtex([
		'% Encoding: UTF-8',
		'This file was exported by some tool, email me @ example.com',
		'',
		'@article{k1,',
		'  title = {First},',
		'}',
		'% Another comment',
		'@article{k2,',
		'  title = {Second}',
		'}',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs.map(r => r.title)).to.deep.equal(['First', 'Second']);
	})
);


test('BibTeX - parse nested braces, inner lines ending in a brace and single line entries').do(t => Promise.resolve()
	.then(()=> readBibtex([
		'@article{k1,',
		'  abstract = {Something {emph}',
		'  more {nested {deeply}} here},',
		'  title = {The {DNA} story}',
		'}',
		'@article{k2, title={Compact}, year={2021}}',
		'@article{k3,',
		'  title = "Quoted, with comma",',
		'  note = "Also quoted"',
		'}',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.have.length(3);
		expect(refs[0]).to.have.property('abstract', 'Something {emph}\n  more {nested {deeply}} here');
		expect(refs[0]).to.have.property('title', 'The {DNA} story');
		expect(refs[1]).to.have.property('title', 'Compact');
		expect(refs[1]).to.have.property('year', '2021');
		expect(refs[2]).to.have.property('title', 'Quoted, with comma');
		expect(refs[2]).to.have.property('notes', 'Also quoted');
	})
);


test('BibTeX - parse unwrapped values').do(t => Promise.resolve()
	.then(()=> readBibtex([
		'@article{k1,',
		'  title = {A},',
		'  year = 2020,',
		'  volume = 12',
		'}',
		'@article{k2,',
		'  title = {B},',
		'  year = 2021}',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.have.length(2);
		expect(refs[0]).to.have.property('year', '2020');
		expect(refs[0]).to.have.property('volume', '12');
		expect(refs[1]).to.have.property('year', '2021');
	})
);


test('BibTeX - parse entries split across arbitrary chunk boundaries').do(t => {
	let content = [
		'@article{k1,',
		'  title = {Alpha {beta}',
		'  gamma},',
		'  year = 2020,',
		'  note = "Delta"',
		'}',
		'@article{k2,',
		'  title = {Epsilon}',
		'}',
	].join('\n');

	return Promise.resolve()
		.then(()=> new Promise((resolve, reject) => { // Feed the content one character at a time
			let refs = [];
			reflib.readStream('bibtex', fakeStreams.readStream([...content]))
				.on('ref', ref => refs.push(ref))
				.on('end', ()=> resolve(refs))
				.on('error', reject);
		}))
		.then(refs => {
			t.dump(refs);
			expect(refs).to.have.length(2);
			expect(refs[0]).to.have.property('title', 'Alpha {beta}\n  gamma');
			expect(refs[0]).to.have.property('year', '2020');
			expect(refs[0]).to.have.property('notes', 'Delta');
			expect(refs[1]).to.have.property('title', 'Epsilon');
		})
});

