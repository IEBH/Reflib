import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from './data/blue-light.js';
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


test('EndNote ENL - map all supported columns into Reflib fields').timeout('30s').do(t => Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.enl`))
	.then(refs => {
		t.dump(refs.find(r => r.recNumber == '895'));
		compareTestRefs(refs);

		let ref = refs.find(r => r.recNumber == '895');
		expect(ref).to.have.property('type', 'journalArticle');
		expect(ref).to.have.property('accessionNum', '29657938');
		expect(ref).to.have.property('databaseProvider', 'NLM');
		expect(ref).to.not.have.property('label'); // Empty columns should be omitted
	})
);


test('EndNote ENL - reference types and arrays survive a write -> read cycle').timeout('30s').do(t => {
	let refs = [
		{recNumber: '1', type: 'book', title: 'A', authors: ['Smith, J.', 'Jones, K.'], keywords: ['alpha', 'beta'], urls: ['http://example.com']},
		{recNumber: '2', type: 'thesis', title: 'B'},
		{recNumber: '3', title: 'C'}, // No type - should default to journalArticle
	];

	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enl'});

	return Promise.resolve()
		.then(()=> reflib.writeFile(tempPath, refs))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.dump(newRefs);
			expect(newRefs.map(r => r.type)).to.deep.equal(['book', 'thesis', 'journalArticle']);
			expect(newRefs[0]).to.have.deep.property('authors', ['Smith, J.', 'Jones, K.']);
			expect(newRefs[0]).to.have.deep.property('keywords', ['alpha', 'beta']);
			expect(newRefs[0]).to.have.deep.property('urls', ['http://example.com']);
		})
});



test('EndNote ENL - short titles and original publications survive a write -> read cycle').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enl'});
	let refs = [{recNumber: '1', type: 'journalArticle', title: 'Full title', titleShort: 'Short title', originalPublication: 'Original publication'}];

	return Promise.resolve()
		.then(()=> reflib.writeFile(tempPath, refs))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.dump(newRefs);
			expect(newRefs[0]).to.deep.equal(refs[0]);
		})
});


test('EndNote ENL - editions survive a write -> read cycle').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.enl'});
	let refs = [{recNumber: '1', type: 'book', title: 'A', edition: '2nd'}];

	return Promise.resolve()
		.then(()=> reflib.writeFile(tempPath, refs))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.dump(newRefs);
			expect(newRefs[0]).to.deep.equal(refs[0]);
		})
});
