import test, {expect} from '@momsfriendlydevco/testa';
import {identifyFormat} from '../lib/default.js';

test('Identify formats from file paths', ()=> {
	expect(identifyFormat('My Refs.csv')).to.have.property('id', 'csv');
	expect(identifyFormat('My Refs.json')).to.have.property('id', 'json');
	expect(identifyFormat('My Refs.nbib')).to.have.property('id', 'medline');
	expect(identifyFormat('My Refs.txt.ris')).to.have.property('id', 'ris');
	expect(identifyFormat('MY REFS.TXT.RIS')).to.have.property('id', 'ris');
	expect(identifyFormat('My Refs.data.tsv')).to.have.property('id', 'tsv');
	expect(identifyFormat('My Refs.xml')).to.have.property('id', 'endnoteXml');
});


test('Return null (not undefined) for unknown or missing extensions', ()=> {
	expect(identifyFormat('My Refs.docx')).to.be.null;
	expect(identifyFormat('My Refs')).to.be.null;
	expect(identifyFormat('/home/user.name/refs')).to.be.null;
});
