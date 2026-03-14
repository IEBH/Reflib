import fakeStreams from './fakeStreams.js';
import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from './data/blue-light.js';
import {createReadStream, createWriteStream} from 'node:fs';
import * as reflib from '../lib/default.js';
import temp from 'temp';

import config from './config.js';


test('EndNoteXML - Simple XML parsing').do(t => Promise.resolve()
	.then(()=> t.stage('Read simple citations with custom key'))
	.then(()=> new Promise((resolve, reject) => {
		let refs = [];

		reflib.readStream('endnoteXml', fakeStreams.readStream(`
<?xml version="1.0" encoding="UTF-8"?>
<xml>
  <records>
    <record>
      <ref-type name="Journal Article"></ref-type>
      <contributors>
        <authors>
          <author>
            AUTHOR 1
          </author>
          <author>AUTHOR 2</author>
        </authors>
      </contributors>
      <titles>
        <title>TITLE</title>
      </titles>
      <dates>
        <year>YEAR</year>
          <pub-dates>
            <date>DATE</date>
          </pub-dates>
      </dates>
      <volume>VOLUME</volume>
      <accession-num>123</accession-num>
      <abstract>ABSTRACT</abstract>
    </record>
  </records>
</xml>
		`))
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve(refs))
			.on('error', reject);
	}))
	.then(refs => {
		t.stage('Check citations have been parsed');
		t.dump(refs);
		expect(refs).to.deep.equal([{
			type: 'journalArticle',
			accessionNum: '123',
			title: 'TITLE',
			date: 'DATE',
			year: 'YEAR',
			volume: 'VOLUME',
			abstract: 'ABSTRACT',
			authors: ['AUTHOR 1', 'AUTHOR 2'],
		}]);

		return refs;
	})
);


// This test verifies that the XML parser doesn't split things like 'Foo &amp; Bar' into multiple parts when parsing
test('EndnoteXML - parse a multipart EndNote XML file').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/multipart.xml`))
	.then(refs => {
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(1);
		expect(refs[0]).to.be.an('object');
		expect(refs[0]).to.have.property('recNumber', '1 & 2');
		expect(refs[0]).to.have.property('type', 'journalArticle');
		expect(refs[0]).to.have.property('authors');
		expect(refs[0].authors).to.deep.equal(['Foo & Bar', 'Baz & Quz']);
		expect(refs[0]).to.have.property('address', 'Foo & Bar');
		expect(refs[0]).to.have.property('title', 'Foo & Bar');
		expect(refs[0]).to.have.property('journal', 'Foo & Journal');
		expect(refs[0]).to.have.property('keywords');
		expect(refs[0].keywords).to.deep.equal(['Foo & Bar', 'Baz & Quz']);
	})
);


test('EndnoteXML - Parse a EndNote XML file #1 (via stream reader)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> new Promise((resolve, reject) => { // Read XML file via emitter
		let refs = [];

		reflib.readStream('endnoteXml', createReadStream(`${config.testPath}/data/blue-light.xml`))
			.on('end', ()=> resolve(refs))
			.on('error', reject)
			.on('ref', ref => refs.push(ref))
	}))
	.then(refs => compareTestRefs(refs))
);


test('EndnoteXML - Read a XML file #2 (via promise)').timeout('30s').do(t => Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.xml`))
	.then(refs => {
		t.dump(refs);
		return compareTestRefs(refs);
	})
);


test('EndnoteXML - Write a XML file #1 (via promise)').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
	return Promise.resolve()
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.xml`))
		.then(refs => reflib.writeFile(tempPath, refs))
		.then(()=> t.log(`XML file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => compareTestRefs(refs))
});


test('EndnoteXML - parse a Zotero exported EndNote XML file').timeout('30s').do(t => Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light-zotero.xml`))
	.then(refs => {
		t.dump(refs);
		return compareTestRefs(refs);
	})
);


test('should stream a XML file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
	return new Promise((resolve, reject) => {
		let output = reflib.writeStream('endnoteXml', createWriteStream(tempPath));

		output.start();

		reflib.readStream('endnoteXml', createReadStream(`${config.testPath}/data/blue-light.xml`))
			.on('ref', ref => output.write(ref))
			.on('end', ()=> output.end().then(resolve))
			.on('error', reject)
	})
		.then(()=> t.log(`XML file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => compareTestRefs(refs))
});


test('should run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
	let originalRefs;
	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.xml`))
		.then(refs => {
			expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.stage(`XML file available at ${tempPath}`))
		.then(()=> t.log('Re-reading ref file'))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.stage('Comparing', newRefs.length, 'references');
			expect(newRefs).to.have.length(originalRefs.length);
			newRefs.forEach((ref, refOffset) => {

				/*
				console.log('Compare', {
					original: originalRefs[refOffset],
					ref,
				});

				Object.entries(originalRefs[refOffset])
					.forEach(([key, expectedVal]) => {
						console.log({
							key,
							'expected': originalRefs[refOffset][key],
							'got_____': newRefs[refOffset][key],
						});
						expect(newRefs[refOffset]).to.have.deep.property(key, expectedVal)
					});
				*/

				expect(ref).to.deep.equal(originalRefs[refOffset])
			});
		})
});


test('should extract URLs from an XML file').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/missing-urls.xml`))
	.then(refs => {
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(1);
		expect(refs[0]).to.be.an('object');
		expect(refs[0]).to.have.property('recNumber', '498');
		expect(refs[0]).to.have.property('type', 'journalArticle');
		expect(refs[0]).to.have.property('authors');
		expect(refs[0].authors).to.deep.equal(['Zhang, Zexin', 'Li, Shu', 'Dai, Xinyue', 'Li, Cong', 'Sun, Pengfei', 'Qu, Jianwen', 'Jiang, Haiyue', 'Pan, Bo']);
		expect(refs[0]).to.have.property('title', 'Association of glucagon-like peptide-1 receptor agonists and seven common mental disorders: A drug target and mediation Mendelian randomization');
		expect(refs[0]).to.have.property('journal', 'Journal of affective disorders');
		expect(refs[0]).to.have.property('pages', '119509');
		expect(refs[0]).to.have.property('volume', '388');
		expect(refs[0]).to.have.property('urls');
		expect(refs[0].urls).to.deep.equal(['https://ovidsp.ovid.com/ovidweb.cgi?T=JS&PAGE=reference&D=med27&NEWS=N&AN=40447157']); // NOTE: This is a decoded URL, not the RAW XML escaped value
	})
);
