/**
* Generic module interface
* This file serves no purpose other than to document the methods that each module can itself expose
*/
/* eslint-disable jsdoc/require-returns-check, no-unused-vars */


/**
* Provide the low-level function for a module to read a stream and emit refs
* @param {stream.Readable} stream Input stream to read from
* @param {Object} [options] Additional options to use when parsing
* @returns {EventEmitter} EventEmitter(-like) that should emit the below events
*
* @emits ref Emitted with a single ref object when found
* @emits end Emitted when parsing has completed
* @emits error Emitted when an error has been raised
* @emits progress Emitted as (bytesRead) when reading a stream
*/
export function readStream(stream, options) {
	// Stub
}


/**
* Provide the low-level function for a module to write a stream
* @param {stream.Writable} stream Output stream to write to
* @param {array<Object>} refs Collection of refs to write
* @param {Object} [options] Additional options to use when writing
*
* @returns {Object} An object which exposes methods to call to start, write and end the writing process. All methods MUST return a Promise
* @property {function<Promise>} start Function to call when beginning to write
* @property {function<Promise>} write Function called as `(ref)` when writing a single ref
* @property {function<promise>} [middle] Function to call after `write()` for each reference if the reference is NOT last, this works similar to `Array.prototype.join()`
* @property {function<Promise>} end Function to call when finishing writing, must resolve its Promise when the stream has closed successfully
*/
export function writeStream(stream, refs, options) {
	// Stub
}


/**
* Function to run to set up any additional data before the module is needed
* This is generally used by worker functions which construct maps from collections for efficiency purposes
*/
export function setup() {
	// Stub
}
