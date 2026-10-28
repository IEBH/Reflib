import {readFile as fsReadFile} from 'node:fs/promises';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';
import temp from 'temp';


test('writeFile - call middle() between references but not after the last').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.bib'});
	let refs = [
		{type: 'journalArticle', title: 'A'},
		{type: 'journalArticle', title: 'B'},
		{type: 'journalArticle', title: 'C'},
	];

	return Promise.resolve()
		.then(()=> reflib.writeFile(tempPath, refs))
		.then(()=> fsReadFile(tempPath, 'utf8'))
		.then(contents => {
			t.dump(contents);
			expect(contents.match(/^\}\n\n/gm)).to.have.length(2); // Two separators for three refs
			expect(contents).to.match(/\}\n$/);
			expect(contents).to.not.match(/\n\n$/);
		})
});
