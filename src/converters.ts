import dayjs from 'dayjs';
import fs from 'fs';
import papa from 'papaparse';
import vscode from 'vscode';

const TIMESTAMP_HEADER_INDEX = 0;
export const DEFAULT_COMPARATOR = (a: string, b: string) => (dayjs(a).valueOf() - dayjs(b).valueOf());

type TracyData = {[s: string]: string};

type FTracyConverter = {
	/**
	 * Gets the headers of the file.
	 * @param file_name The name of the file to get the headers from.
	 * @returns A promise of the headers of that file.
	 */
	getHeaders: (file_name: string) => Promise<string[]>;
	/**
	 * Gets the first and last timestamps of the input file.
	 * @param file_name The name of the file that is to be converted.
	 * @param header The header that denotes the time/id of the row/entry.
	 * @returns A promise of the first and the last timestamp in the file as Dayjs objects.
	 */
	getTimestamps: (file_name: string) => Promise<[string, string]>;
	/**
	 * Opens and converts the given file, only returns the rows/entries that have a time/id between the given constraints.
	 * @param file_name The name of the file that is to be converted.
	 * @param header The header that denotes the time/id of the row/entry.
	 * @param constraints A tuple containing values used for filtering the output, they are compared using the comparator.
	 * @returns A promise of the resulting tracy object array.
	 */
	getData: (file_name: string, constraints: [string, string]) => Promise<TracyData[]>;

	/**
	 * This is an optional parameter, it should only be used when one wants to reuse one of the old converters.
	 * @param content A string containing all the text of a CSV file.
	 * @returns A tracy object array;
	 */
	old_converter?: (content: string) => TracyData[];
};

const PARSER_CHUNK_SIZE = 1024; // I don't know how big we want this
// This is the default converter. It uses streams to convert CSV files. Better for large files.
const TRACY_STREAM_PAPAPARSER: FTracyConverter = {
	getHeaders: function (file_name: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			papa.parse<string[]>(fs.createReadStream(file_name), {
				preview: 1,
				step: (results) => {
					resolve(results.data); // reading only the first line gives an array of headers
				},
				error: (error) => {
					reject(error);
				}
			});
		});
	},
	getTimestamps: function (file_name: string): Promise<[string, string]> {
		return new Promise<[string, string]>((resolve, reject) => {
			let firstChunk = true;
			let firstDate = "";
			let lastDate = "";
			// Stream the files
			const stream: fs.ReadStream = fs.createReadStream(file_name);
			// The parser does not have a completion call, so use the stream to do so
			stream.addListener('close', () => {
				if (firstDate && lastDate) resolve([firstDate, lastDate]);
				else reject(`problem with first date "${firstDate}" and/or last date "${lastDate}"`);
			});
			
			papa.parse<string[]>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				chunk: (results) => {
					if (firstChunk) { // Get the first timestamp
						firstDate = results.data[1][TIMESTAMP_HEADER_INDEX]; // The index is 1 to skip the header row
						firstChunk = false;
					}
					// Get the last timestamp of every chunk call, only the last one will be used
					if (results.data.length > 0)
						lastDate = results.data.at(-1)![TIMESTAMP_HEADER_INDEX];
				},
				error: (error) => {
					reject(error);
				},
				complete: () => {
					// typescript complains if I don't add this, but this is never called
				}
			});
		});
	},
	getData: function (file_name: string, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			const contents: TracyData[] = [];
			const stream = fs.createReadStream(file_name);
			// The parser does not have a completion call, so use the stream to do so
			stream.addListener("close", () => {
				resolve(contents);
			});
			papa.parse<TracyData>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				header: true,
				chunk: (results) => {
					const headerField = results.meta.fields![TIMESTAMP_HEADER_INDEX];
					results.data.forEach((row) => {
						const timestampString = row[headerField];
						// If within the timestamp constraints, then add it to the contents
						if (DEFAULT_COMPARATOR(constraints[0], timestampString) <= 0 && DEFAULT_COMPARATOR(timestampString, constraints[1]) <= 0)
							contents.push(row);
					})
				},
				error: (error) => {
					reject(error);
				},
				complete: () => {}
			});
		});
	}
}

// For backwards compatability. This is an example of how the old parser/converter implementations can be reused.
const TRACY_STRING_STANDARD_CONVERTER: FTracyConverter = {
	old_converter: standardConvert, // Just put the old version here
	getHeaders: function (file_name: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then(doc => doc.getText()).then((doc) => { // open using vscode
				const data = this.old_converter!(doc); // convert with the legacy converter
				if (data.length === 0) return reject("Converter could not convert");
				const headers = Object.keys(data[0]);
				resolve(headers);
			}, (error) => {
				reject(error);
			});
		});
	},
	getTimestamps: function (file_name: string): Promise<[string, string]> {
		return new Promise<[string, string]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then((doc) => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				const headers = Object.keys(data[0]);
				if (data.length === 0) return reject("Converter could not convert");
				resolve([data[0][headers[TIMESTAMP_HEADER_INDEX]], data.at(-1)![headers[TIMESTAMP_HEADER_INDEX]]]); // return the time values of the first and last entry
			}, (error) => {
				reject(error);
			});
		});
	},
	getData: function (file_name: string, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then(doc => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				if (data.length === 0) return reject("Converter could not convert");
				const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
				// filter the data, remove the entries not within the set time range
				resolve(data.filter(entry => (DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0 && DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0)));
			}, (error) => {
				reject(error);
			});
		});
	}
}

const TRACY_IENGINE: FTracyConverter = {
	getHeaders: function (file_name: string): Promise<string[]> {
		return new Promise((_resolve, reject) => reject('Function not implemented.'));
	},
	getTimestamps: function (file_name: string): Promise<[string, string]> {
		return new Promise((_resolve, reject) => reject('Function not implemented.'));
	},
	getData: function (file_name: string, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise((_resolve, reject) => reject('Function not implemented.'));
	}
}

export const NEW_CONVERTERS: {[s: string]: FTracyConverter} = {
	"CSV automatic": TRACY_STREAM_PAPAPARSER,
	"CSV standard (small files only)": TRACY_STRING_STANDARD_CONVERTER,
	"iEngine format": TRACY_IENGINE,
};

/**
 * Get the headers of the input files.
 * @param file_names The names of the files from which to get the headers.
 * @param converters The converters, index bound to the file names, with which to get the headers.
 * @returns A promise for all the headers of the files, index bound to the file names.
 */
export function getHeaders(file_names: string[], converters: string[]): Promise<PromiseSettledResult<string[]>[]>{
	return Promise.allSettled(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getHeaders(file_name);
	}));
}

/**
 * Get the first and last values of the specified headers of the input files.
 * @param file_names The names of the files from which to get the values.
 * @param converters The converters, index bound to the file names, with which to get the headers' values.
 * @returns A promise for first and last entries' specified headers' values of the files, index bound to the file names.
 */
export function getTimestamps(file_names: string[], converters: string[]): Promise<PromiseSettledResult<[string, string]>[]> {
	return Promise.allSettled(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getTimestamps(file_name);
	}));
}

/**
 * Convert the given files into tracy object arrays.
 * @param file_names The names of the files which should be converted.
 * @param converters The converters, index bound to the file names, with which to convert the files.
 * @param constraints A tuple containing values used for filtering the output, they are compared using the comparator.
 * @returns An array of tracy object arrays.
 */
export function getConversion(file_names: string[], converters: string[], constraints: [string, string]): Promise<PromiseSettledResult<TracyData[]>[]> {
	return Promise.allSettled(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getData(file_name, constraints);
	}));
}

/**
 * The standard CSV file converter, gets the rows using '\n' and gets the columns using ','.
 * @deprecated since v0.0.2.
 * @param content A string containing all the text of a CSV file.
 * @returns A tracy object array;
 */
function standardConvert(content: string) {
	const rows = content.split('\n').filter((l) => l.trim() !== '').map((l) => l.split(','));
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
}

// Define your own converter on runtime
export const COL_DELIMITERS: {[s: string]: string} = {
	'Comma ","'    	: ',',
	'Semicolon ";"'	: ';',
	'Colon ":"'		: ':',
	'Tab "\t"'		: '\t',
	'Line "|"'		: '|',
};
export const ROW_DELIMITERS: {[s: string]: string} = {
	'Newline "\n"'  		: '\n', // Unix and unix-like (also works for windows I believe because that uses \r\n)
	'Carriage Return "\r"'	: '\r', // old apple computers
	'Tab "\t"'				: '\t',
}
/**
 * A converter where almost all parameters can be determined on runtime.
 * @deprecated since v0.0.2 (in which it appeared)
 * @param content The content of a CSV file, including header
 * @param col_delimiter The column delimiter of the CSV file.
 * @param row_delimiter The row delimiter of the CSV file.
 * @param sort_by_column The column to sort by.
 * @returns A tracy object.
 */
function customSingleConverter(content: string, col_delimiter: string = ',', row_delimiter: string = '\n', sort_by_column: string | undefined) {
	const rows = content.split(row_delimiter) // split by row delimiter
		.filter((l) => l.trim() !== '') // remove leading and trailing whitespace
		.map((l) => l.split(col_delimiter)); // split by column delimiter and copy to new array
	const headers = rows[0];
	const toBeSorted = rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
	if (sort_by_column) return toBeSorted.sort((a: TracyData, b: TracyData) => {
		return a[sort_by_column] > b[sort_by_column] ? 1 : -1;
	});
	return toBeSorted;
}

/**
 * Returns a likely candidate for a CSV file's column delimiter.
 * @deprecated since v0.0.2 (in which it appeared)
 * @param content A slice of CSV content that contains multiple rows. The bigger the slice, the more accurate this function becomes.
 * @param row_delimiter The row delimiter, default='\n'.
 * @returns A char which is occurs the same amount of times in each row.
 */
function getColumnDelimiter(content: string, row_delimiter: string = '\n') {
	// this function assumes that the row delimiter is a newline
	// will start simple by checking the amount of chars of each row and checking if they are the same
	const rows = content.slice(0, content.lastIndexOf(row_delimiter)) // ensure only checking complete rows
		.split(row_delimiter).filter((l)=> l.trim() !== '');
	
	const charCounts = rows.map((row: string) => {
		// get the char count of a row
		const count: {[s: string]: number} = {};
		[...row].forEach(char => {
			if (!(char in count)) count[char] = 0;
			count[char] = count[char] + 1;
		});
		return count;
	});

	// only keep the chars that are present in each row, and occur the same amount of times
	const sharedCharCounts = charCounts.reduce((prev_row, current_row) => {
		const intersectChars: {[s: string]: number} = {};
		for (const char in prev_row) {
			if (current_row[char] === prev_row[char]) intersectChars[char] = prev_row[char]; // keep only the chars that both rows have
		}
		return intersectChars;
	});
	// console.log("Found delimiters: ", shared_char_counts);
	const sharedChars = Object.keys(sharedCharCounts);
	if (sharedChars.length > 0) return sharedChars[0];
	return ','; // if no shared character is found, return the default delimiter
}

/**
 * Automatic CSV converter.
 * @deprecated since v0.0.2 (in which it appeared)
 * @param content CSV file contents, with '\n' as the row delimiter.
 * @returns Tracy json of the input
 */
function autoCSVConverter(content: string): TracyData[] {
	// Only use a slice of the string to compute the column delimiter, on account of efficiency
	const colDelimiter = getColumnDelimiter(content.slice(0, Math.min(5000, content.length)));
	const rows = content.split('\n').filter((l) => l.trim() !== '').map((l) => l.split(colDelimiter));
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
}

// List all converters here, key will be the name, value is the converter function
export const CONVERTERS: {[s: string]: (content: string, ...args: (string | undefined)[]) => TracyData[]} = {
	'Auto converter'			: autoCSVConverter,
	'Using standard converter' 	: standardConvert,
	'Define custom converter' 	: customSingleConverter, // name is used in extension.ts
}

/**
 * Combines multiple instances of tracy object arrays.
 * @param contents The contents of the CSV files in tracy format.
 * @param sort_headers The headers that will be compared to each other for sorting the data.
 * @returns A single tracy object array.
 */
export function multiTracyCombiner(contents: TracyData[][]) : TracyData[] {
	// Empty contents?
	contents = contents.filter(arr => arr.length > 0);
	// Combine all headers
	const allHeadersArray = Object.keys(contents.map(tracy_array => tracy_array[0]).reduce((prev, curr) => {
		return {...prev, ...curr};
	}, []));
	const allHeaders: TracyData = {};
	allHeadersArray.forEach((key) => { allHeaders[key] = ""; });
	
	return contents.reduce((prev, current, index) => {
		if (prev.length === 0) return current;
		if (current.length === 0) return prev;
		const prevHeader = Object.keys(prev[0])[TIMESTAMP_HEADER_INDEX];
		const currHeader = Object.keys(current[0])[TIMESTAMP_HEADER_INDEX];
		// assumption is that the "timestamp"s are already sorted in both prev and current
		// this means an insertion sort/merge is efficient
		let prevIndex = 0;
		let currentIndex = 0;
		const output: TracyData[] = [];
		while (prevIndex < prev.length || currentIndex < current.length) {
			// If over the limit of the one, add the other
			if (prevIndex === prev.length) output.push({ ...allHeaders, ...current[currentIndex++] });
			else if (currentIndex === current.length) output.push({ ...allHeaders, ...prev[prevIndex++] });
			// Add the entry with the smallest timestamp
			else if (DEFAULT_COMPARATOR(prev[prevIndex][prevHeader], current[currentIndex][currHeader]) <= 0) {
				output.push({ ...allHeaders, ...prev[prevIndex++] });
			} else {
				output.push({ ...allHeaders, ...current[currentIndex++] });
			}
		}
		return output;
	}, []);
}
