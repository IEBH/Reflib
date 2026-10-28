import camelCase from '../shared/camelCase.js';
import emitter from '../shared/emitter.js';
import test, {expect} from '@momsfriendlydevco/testa';


test('camelCase - camelize space and dash separated words').do(()=> {
	expect(camelCase('hello')).to.equal('hello');
	expect(camelCase('Foo bar-baz')).to.equal('fooBarBaz');
	expect(camelCase('ALL CAPS')).to.equal('allCaps');
	expect(camelCase('Journal Article')).to.equal('journalArticle');
});


test('emitter - chain on / emit / off calls').do(()=> {
	let calls = [];
	let handler = val => calls.push(val);
	let e = emitter();

	expect(e.on('foo', handler)).to.equal(e);
	expect(e.emit('foo', 1)).to.equal(e);
	expect(e.off('foo', handler)).to.equal(e);
	e.emit('foo', 2);

	expect(calls).to.deep.equal([1]);
});
