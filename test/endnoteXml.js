import {expect} from 'chai';
import {compareTestRefs} from './data/blue-light.js';
import {createReadStream, createWriteStream} from 'node:fs';
import * as reflib from '../lib/default.js';
import fspath from 'node:path';
import mlog from 'mocha-logger';
import temp from 'temp';

let __dirname = fspath.resolve(fspath.dirname(decodeURI(new URL(import.meta.url).pathname)));

describe('Module: endnoteXml', ()=> {

	// Parse Multi-part XML file (via stream reader) {{{
	/**
	* This test verifies that the XML parser doesn't split things like 'Foo &amp; Bar' into multiple parts when parsing
	*/
	it('should parse a multipart EndNote XML file', function () {
		this.timeout(30 * 1000); //= 30s

		return reflib.readFile(`${__dirname}/data/multipart.xml`)
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
	});
	// }}}

	// Parse EndNote XML file #1 (via stream reader) {{{
	it('should parse a EndNote XML file #1 (via stream reader)', function () {
		this.timeout(30 * 1000); //= 30s

		return Promise.resolve()
			// Read XML file via emitter {{{
			.then(()=> new Promise((resolve, reject) => {
				let refs = [];

				reflib.readStream('endnoteXml', createReadStream(`${__dirname}/data/blue-light.xml`))
					.on('end', ()=> resolve(refs))
					.on('error', reject)
					.on('ref', ref => refs.push(ref))
			}))
			// }}}
			.then(refs => compareTestRefs(refs))
	});
	// }}}

	// Parse XML file #2 (via promise) {{{
	it('should read a XML file #2 (via promise)', function () {
		this.timeout(30 * 1000); //= 30s

		return reflib.readFile(`${__dirname}/data/blue-light.xml`)
			.then(refs => compareTestRefs(refs))
	});
	// }}}

	// Write XML file (via promise) {{{
	it('should write a XML file #1 (via promise)', function() {
		this.timeout(30 * 1000); //= 30s

		let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
		return Promise.resolve()
			.then(()=> reflib.readFile(`${__dirname}/data/blue-light.xml`))
			.then(refs => reflib.writeFile(tempPath, refs))
			.then(()=> mlog.log(`XML file available at ${tempPath}`))
			.then(()=> reflib.readFile(tempPath))
			.then(refs => compareTestRefs(refs))
	});
	// }}}

	// Stream XML file {{{
	it('should stream a XML file', function() {
		this.timeout(30 * 1000); //= 30s

		let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
		return new Promise((resolve, reject) => {
			let output = reflib.writeStream('endnoteXml', createWriteStream(tempPath));

			output.start();

			reflib.readStream('endnoteXml', createReadStream(`${__dirname}/data/blue-light.xml`))
				.on('ref', ref => output.write(ref))
				.on('end', ()=> output.end().then(resolve))
				.on('error', reject)
		})
			.then(()=> mlog.log(`XML file available at ${tempPath}`))
			.then(()=> reflib.readFile(tempPath))
			.then(refs => compareTestRefs(refs))
	});
	// }}}

	// End-to-end test {{{
	it('should run a parse -> write -> parse test with all references', function() {
		this.timeout(60 * 1000); //= 1m

		let tempPath = temp.path({prefix: 'reflib-', suffix: '.xml'});
		let originalRefs;
		return Promise.resolve()
			.then(()=> mlog.log('Reading ref file'))
			.then(()=> reflib.readFile(`${__dirname}/data/blue-light.xml`))
			.then(refs => {
				expect(refs).to.have.length(102);
				originalRefs = refs;
			})
			.then(()=> mlog.log('Writing ref file'))
			.then(()=> reflib.writeFile(tempPath, originalRefs))
			.then(()=> mlog.log(`XML file available at ${tempPath}`))
			.then(()=> mlog.log('Re-reading ref file'))
			.then(()=> reflib.readFile(tempPath))
			.then(newRefs => {
				mlog.log('Comparing', newRefs.length, 'references');
				expect(newRefs).to.have.length(originalRefs.length);
				newRefs.forEach((ref, refOffset) =>
					expect(ref).to.deep.equal(originalRefs[refOffset])
				);
			})
	});
	// }}}

	it('should extract URLs from an XML file', function() {
		this.timeout(30 * 1000); //= 30s

		return reflib.readFile(`${__dirname}/data/missing-urls.xml`)
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
	});

});
