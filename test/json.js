import fakeStreams from './fakeStreams.js';
import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from './data/blue-light.js';
import {createReadStream, createWriteStream} from 'node:fs';
import * as reflib from '../lib/default.js';
import temp from 'temp';
import {writeFile} from 'node:fs/promises';

import config from './config.js';


test('JSON - parse a JSON file #1 (via stream reader)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> new Promise((resolve, reject) => { // Read JSON file via emitter
		let refs = [];

		reflib.readStream('json', createReadStream(`${config.testPath}/data/blue-light.json`))
			.on('end', ()=> resolve(refs))
			.on('error', reject)
			.on('ref', ref => refs.push(ref))
	}))
	.then(refs => compareTestRefs(refs))
);


test('should read a JSON file #2 (via promise)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
	.then(refs => compareTestRefs(refs))
);


test('JSON - write a JSON file #1 (via promise)').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return Promise.resolve()
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
		.then(refs => reflib.writeFile(tempPath, refs))
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => {
			expect(refs).to.be.an('array');
			expect(refs).to.have.length(102);
			return compareTestRefs(refs);
		})
});


test('JSON - stream a JSON file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return new Promise((resolve, reject) => {
		let output = reflib.writeStream('json', createWriteStream(tempPath));

		output.start();

		reflib.readStream('json', createReadStream(`${config.testPath}/data/blue-light.json`))
			.on('ref', ref => output.write(ref))
			.on('end', ()=> output.end().then(resolve))
			.on('error', reject)
	})
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => {
			expect(refs).to.be.an('array');
			return compareTestRefs(refs);
		})
});


test('JSON - run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
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
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.stage('Comparing', newRefs.length, 'references');
			newRefs.forEach((ref, refOffset) =>
				expect(ref).to.deep.equal(originalRefs[refOffset])
			);
		})
});


test('JSON - reject malformed JSON instead of hanging').timeout('5s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return Promise.resolve()
		.then(()=> t.stage('Via stream reader'))
		.then(()=> new Promise((resolve, reject) => {
			reflib.readStream('json', fakeStreams.readStream('[{"title": "A"}, {broken'))
				.on('end', ()=> reject(new Error('Stream ended without an error event')))
				.on('error', resolve);
		}))
		.then(e => {
			t.dump(e);
			expect(e).to.be.an.instanceOf(Error);
		})
		.then(()=> t.stage('Via readFile'))
		.then(()=> writeFile(tempPath, '[{"title": "A"}, {broken'))
		.then(()=> reflib.readFile(tempPath))
		.then(
			()=> { throw new Error('readFile should have rejected') },
			e => expect(e).to.be.an.instanceOf(Error),
		)
});



/**
* Write references to a JSON string via the stream writer
*
* @param {Array<Object>} refs References to write
* @param {Object} [options] Options to pass to the writer
* @returns {Promise<String>} The written JSON content
*/
function writeJson(refs, options) {
	let fakeWriter = fakeStreams.writeStream();
	let stream = reflib.writeStream('json', fakeWriter, options);
	return Promise.resolve()
		.then(()=> stream.start())
		.then(()=> refs.reduce((chain, ref) => chain.then(()=> stream.write(ref)), Promise.resolve()))
		.then(()=> stream.end())
		.then(()=> fakeWriter.contents());
}


/**
* Read a JSON string via the stream reader
*
* @param {String} content JSON content to parse
* @returns {Promise<Array<Object>>} The parsed references
*/
function readJson(content) {
	return new Promise((resolve, reject) => {
		let refs = [];
		reflib.readStream('json', fakeStreams.readStream(content))
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve(refs))
			.on('error', reject);
	});
}


test('JSON - write an empty library as valid JSON').do(t => Promise.resolve()
	.then(()=> writeJson([]))
	.then(contents => {
		t.dump(contents);
		expect(JSON.parse(contents)).to.deep.equal([]);
		return readJson(contents);
	})
	.then(refs => expect(refs).to.deep.equal([]))
);


test('JSON - assign positional recNumbers on read without overwriting existing ones').do(t => Promise.resolve()
	.then(()=> readJson('[{"title": "A"}, {"recNumber": 7, "title": "B"}, {"title": "C"}]'))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.deep.equal([
			{recNumber: 1, title: 'A'},
			{recNumber: 7, title: 'B'},
			{recNumber: 3, title: 'C'},
		]);
	})
);


test('JSON - sort well known keys by priority before other keys').do(t => Promise.resolve()
	.then(()=> writeJson([{
		abstract: 'Abstract',
		zzz: 'Unknown',
		pages: '1-2',
		authors: ['X'],
		title: 'Title',
		type: 'book',
		recNumber: 1,
	}]))
	.then(contents => {
		t.dump(contents);
		expect(Object.keys(JSON.parse(contents)[0])).to.deep.equal([
			'recNumber',
			'type',
			'title',
			'authors',
			'pages',
			'zzz',
			'abstract',
		]);
	})
);


test('JSON - honour the indent and sortKeys options').do(t => Promise.resolve()
	.then(()=> writeJson([{zzz: 1, title: 'A'}], {indent: 0, sortKeys: false}))
	.then(contents => {
		t.dump(contents);
		expect(contents).to.equal('[\n{"zzz":1,"title":"A"}\n]');
	})
	.then(()=> writeJson([{title: 'A'}], {indent: '\t'}))
	.then(contents => {
		t.dump(contents);
		expect(contents).to.equal('[\n{\n\t"title": "A"\n}\n]');
	})
);
