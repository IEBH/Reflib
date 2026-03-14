import Emitter from '../../shared/emitter.js';
import CacxParser from '@iebh/cacx';

export class WritableStream {
	constructor(passedParserOptions) {
		this.emitter = Emitter();
		this.parser = new CacxParser({
			collect: false,
			reAttrSegment: /(?<key>[a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?<escape>["'])(?<val>.*?)\k<escape>)?/ig,
			onTagOpen: (node) => {
				const name = node.tag;
				const attrs = node.attrs || {};
				this.emitter.emit('opentag', name, attrs);
			},
			onTagClose: (node) => {
				const name = node.tag;
				// Emit text event before closing the tag
				if (node.text && node.text.trim()) {
					this.emitter.emit('text', node.text.trim());
				}
				this.emitter.emit('closetag', name);
			},
			flattenText: false,
			keyText: 'text',
			keyAttrs: 'attrs',
		});

		// Add event listeners
		this.emitter.on('opentag', passedParserOptions.onopentag);
		this.emitter.on('closetag', passedParserOptions.onclosetag);
		this.emitter.on('text', passedParserOptions.ontext);
		this.emitter.on('end', passedParserOptions.onend);
	}

	write(data) {
		this.parser.append(data).exec();
	}

	end() {
		// Process any remaining data
		this.parser.exec();

		// Emit text event for the last node if it has text
		const lastNode = this.parser.stack.at(-1);
		if (lastNode && lastNode.text && lastNode.text.trim()) {
			this.emitter.emit('text', lastNode.text.trim());
		}

		// Emit end event
		this.emitter.emit('end');
	}
}
