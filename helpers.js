const { Readable } = require('stream');
const constants = require('./constants')
const base64 = require('buffer').Buffer;
function getText(inputData) {
    /**
     * Decodes and extracts readable text from a byte array.
     */
    const START = 2;
    const END = 3;
    const result = [];
    let cursor = 0;

    while (cursor < inputData.length) {
        const byte = inputData[cursor];
        if (byte === START) {
            cursor += 2; // Skip START and kind byte
            const length = getInt(inputData, cursor);
            cursor += 1 + length; // Skip length byte and data
            if (inputData[cursor] !== END) {
                throw new Error("Invalid format: missing END marker");
            }
            cursor += 1; // Skip END byte
            continue;
        }
        result.push(byte);
        cursor += 1;
    }

    return Buffer.from(result).toString('utf-8');
}

function getInt(cursor) {
    /**
     * Reads an integer from the cursor based on variable-length encoding.
     */
    let marker = cursor.readUInt8(cursor.position++);
    if (marker < 0xD0) {
        return marker - 1;
    }

    marker = (marker + 1) & 0xF;
    const result = Buffer.alloc(4);

    for (let i = 0; i < 4; i++) {
        if (marker & (1 << i)) {
            result[3 - i] = cursor.readUInt8(cursor.position++);
        }
    }

    return result.readUInt32LE(0);
}

function doReplacements(text) {
    /**
     * Replaces specific characters in text based on the REPLACEMENTS map.
     */
    for (const [needle, replacement] of Object.entries(constants.REPLACEMENTS)) {
        text = text.split(needle).join(replacement);
    }
    return text;
}


function decodeField(field) {
        /**
         * Safely decodes a Base64 field if possible.
         */
        return Buffer.from(field, 'base64').toString('utf-8');

}

module.exports = { getInt,getText,doReplacements,decodeField };