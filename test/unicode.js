import fakeStreams from './fakeStreams.js';
import test, {expect} from '@momsfriendlydevco/testa';
import * as reflib from '../lib/default.js';


[
	'bibtex',
	'endnoteXml',
	'json',
	'medline',
	'ris',
].forEach(module => {

	test(`${module} - non-ASCII titles and authors survive a write -> read cycle`).do(t => {
		let ref = {
			recNumber: '1',
			type: 'journalArticle',
			title: 'Ünïcødé — “quotes” 日本語 😀',
			authors: ['Müller, J.', 'Ørsted, H.'],
		};
		let fakeWriter = fakeStreams.writeStream();
		let stream = reflib.writeStream(module, fakeWriter);

		return Promise.resolve()
			.then(()=> stream.start())
			.then(()=> stream.write(ref))
			.then(()=> stream.end())
			.then(()=> new Promise((resolve, reject) => {
				let refs = [];
				reflib.readStream(module, fakeStreams.readStream(fakeWriter.contents()))
					.on('ref', ref => refs.push(ref))
					.on('end', ()=> resolve(refs))
					.on('error', reject);
			}))
			.then(refs => {
				t.dump(refs);
				expect(refs).to.have.length(1);
				expect(refs[0]).to.have.property('title', ref.title);
				expect(refs[0]).to.have.deep.property('authors', ref.authors);
			})
	});

});
