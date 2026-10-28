import fakeStreams from './fakeStreams.js';
import {formats} from '../lib/formats.js';
import {readFile as fsReadFile, writeFile as fsWriteFile} from 'node:fs/promises';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';
import temp from 'temp';


test('getModule - reject missing or unknown modules').do(()=> {
	expect(()=> reflib.getModule()).to.throw(/No module provided/);
	expect(()=> reflib.getModule('nope')).to.throw(/Unknown module "nope"/);
});


test('readStream / writeStream - reject missing modules or streams').do(()=> {
	expect(()=> reflib.readStream()).to.throw(/No module provided/);
	expect(()=> reflib.readStream('ris')).to.throw(/No stream provided/);
	expect(()=> reflib.writeStream()).to.throw(/No module provided/);
	expect(()=> reflib.writeStream('ris')).to.throw(/No stream provided/);
});


test('formats - every readable / writable format has a matching module function').do(t => {
	let problems = Object.values(formats)
		.flatMap(format => [
			format.canRead && typeof reflib.getModule(format.id).readStream != 'function' && `${format.id} cannot read`,
			format.canWrite && typeof reflib.getModule(format.id).writeStream != 'function' && `${format.id} cannot write`,
		])
		.filter(Boolean);

	t.dump(problems);
	expect(problems).to.deep.equal([]);
});


test('formats - ids match their keys and no extension is claimed twice').do(t => {
	let exts = Object.values(formats).flatMap(format => format.ext);

	Object.entries(formats).forEach(([key, format]) =>
		expect(format).to.have.property('id', key)
	);

	t.dump(exts);
	expect(exts.filter((ext, index) => exts.indexOf(ext) !== index)).to.deep.equal([]);
	exts.forEach(ext => expect(ext).to.match(/^\.[a-z]+$/));
});


test('readFile / writeFile - throw for paths with no identifiable format').do(()=> {
	expect(()=> reflib.readFile('refs.docx')).to.throw(/Unable to identify/);
	expect(()=> reflib.writeFile('refs.docx', [])).to.throw(/Unable to identify/);
});


test('readFile / writeFile - honour options.module over the file extension').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.dat'});
	let refs = [{recNumber: '1', type: 'book', title: 'A'}];

	return Promise.resolve()
		.then(()=> reflib.writeFile(tempPath, refs, {module: 'bibtex'}))
		.then(()=> fsReadFile(tempPath, 'utf8'))
		.then(contents => {
			t.dump(contents);
			expect(contents).to.match(/^@Book\{RN1,/);
			return reflib.readFile(tempPath, {module: 'bibtex'});
		})
		.then(newRefs => {
			t.dump(newRefs);
			expect(newRefs).to.deep.equal(refs);
		})
});


test('readFile - emit an end event with the number of references found').timeout('30s').do(()=> {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.ris'});
	let endEvents = [];

	return Promise.resolve()
		.then(()=> fsWriteFile(tempPath, 'TY  - JOUR\nTI  - A\nER  - \n\nTY  - JOUR\nTI  - B\nER  - \n'))
		.then(()=> {
			let reader = reflib.readFile(tempPath);
			reader.emitter.on('end', e => endEvents.push(e));
			return reader;
		})
		.then(refs => {
			expect(refs).to.have.length(2);
			expect(endEvents).to.deep.equal([{refsFound: 2}]);
		})
});


test('readFile - reject when the file does not exist').timeout('5s').do(()=> reflib
	.readFile(temp.path({prefix: 'reflib-missing-', suffix: '.ris'}))
	.then(
		()=> { throw new Error('readFile should have rejected') },
		e => expect(e).to.have.property('code', 'ENOENT'),
	)
);


test('writeStream - writing nothing produces a library that reads back as empty').do(t => Object.values(formats)
	.filter(format => format.canRead && format.canWrite && format.id != 'endnoteEnl') // ENL is a binary SQLite format and not stream writable to memory
	.reduce((chain, format) => chain
		.then(()=> {
			let fakeWriter = fakeStreams.writeStream();
			let stream = reflib.writeStream(format.id, fakeWriter);
			return Promise.resolve()
				.then(()=> stream.start())
				.then(()=> stream.end())
				.then(()=> fakeWriter.contents());
		})
		.then(contents => new Promise((resolve, reject) => {
			let refs = [];
			reflib.readStream(format.id, fakeStreams.readStream(contents))
				.on('ref', ref => refs.push(ref))
				.on('end', ()=> resolve(refs))
				.on('error', reject);
		}))
		.then(refs => {
			t.log(`${format.id} - ${refs.length} refs`);
			expect(refs, format.id).to.deep.equal([]);
		})
	, Promise.resolve())
);
