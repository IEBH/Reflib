import {fields} from '../lib/fields.js';
import * as reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';


test('Fields - type list contains magazineArticle (not a typo)').do(()=> {
	expect(fields.type.values).to.include('magazineArticle');
	expect(fields.type.values).to.not.include('agazineArticle');
});


test('Fields - every type used by the RIS and EndNote XML modules exists in the field spec').do(t => {
	let knownTypes = new Set(fields.type.values);
	let unknown = [
		...reflib.getModule('ris').translations.types.collection.map(type => ['ris', type.rl]),
		...reflib.getModule('endnoteXml').translations.types.collection.map(type => ['endnoteXml', type.rl]),
	].filter(([, type]) => !knownTypes.has(type));

	t.dump(unknown);
	expect(unknown).to.deep.equal([]);
});


test('Fields - every Medline publication type maps to a known type and no raw value is duplicated').do(t => {
	let knownTypes = new Set(fields.type.values);
	let collection = reflib.getModule('medline').translations.types.collection;

	let unknown = collection
		.filter(type => type.rl !== '' && !knownTypes.has(type.rl)) // Blank `rl` marks an intentionally unsupported type
		.map(type => type.raw + ' -> ' + type.rl);

	let duplicates = collection
		.map(type => type.raw)
		.filter((raw, index, all) => all.indexOf(raw) !== index);

	t.dump({unknown, duplicates});
	expect(unknown).to.deep.equal([]);
	expect(duplicates).to.deep.equal([]);
});
