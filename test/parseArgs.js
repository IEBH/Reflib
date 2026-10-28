import parseArgs from '../shared/parseArgs.js';
import test, {expect} from '@momsfriendlydevco/testa';


test('parseArgs - parse long, short, variadic and positional arguments').do(()=> {
	expect(parseArgs.parse(['pos', '--name', 'Alice', 'Bob', '--verbose', '-n', '42', '-xvf', 'file1', 'file2', '--', '-x'])).to.deep.equal({
		_: ['pos', '-x'],
		name: ['Alice', 'Bob'],
		verbose: true,
		n: '42',
		x: true,
		v: true,
		f: ['file1', 'file2'],
	});
});


test('parseArgs - parse --flag=value forms').do(()=> {
	expect(parseArgs.parse(['--input=foo.xml', '--output=out dir/bar.ris', '--empty=', '--format', 'ris', '--url=http://x?a=1'])).to.deep.equal({
		_: [],
		input: 'foo.xml',
		output: 'out dir/bar.ris',
		empty: '',
		format: 'ris',
		url: 'http://x?a=1',
	});
});


test('parseArgs - expand short flags into long flags').do(()=> {
	expect(parseArgs.expand({_: [], i: 'in.xml', v: true, other: 1}, {i: 'input', v: 'verbose', o: 'output'})).to.deep.equal({
		_: [],
		input: 'in.xml',
		verbose: true,
		other: 1,
	});
});
