import dayjs, { Dayjs } from 'dayjs';
import fs from 'fs';
import papa from 'papaparse';
import vscode from 'vscode';

// This has to match the package.json contributes.commands.command value
export const COMMAND_ID = "extension.tracyCsvConverter";

// Make this something unique
export const SCHEME = 'vscodeTracyCsvConverter';

type TracyData = {[s: string]: string};

type FTracyConverter = {
	/**
	 * Gets the headers of the file
	 * @param file_name The name of the file to get the headers from
	 * @returns A promise of the headers of that file
	 */
	getHeaders: (file_name: string) => Promise<string[]>;
	/**
	 * Gets the first and last timestamps of the input file
	 * @returns A promise of the first and the last timestamp in the file as Dayjs objects
	 */
	getTimestamps: (file_name: string, header: number) => Promise<[string, string]>;
	getData: (file_name: string, header: number, comparator: (a: string, b: string) => number, constraints: [string, string]) => Promise<TracyData[]>;

	old_converter?: (s: string) => TracyData[];
};

const PARSER_CHUNK_SIZE = 1024; // I don't know how big we want this
const TracyStreamPapaparser: FTracyConverter = {
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
	getTimestamps: function (file_name: string, header_index: number): Promise<[string, string]> {
		return new Promise<[string, string]>((resolve, reject) => {
			let first_chunk = true;
			let first_date = "";
			let last_date = "";
			// Stream the files
			const stream = fs.createReadStream(file_name);
			// The parser does not have a completion call, so use the stream to do so
			stream.addListener('close', () => {
				if (first_date && last_date) resolve([first_date, last_date]);
				else reject(`problem with first date "${first_date}" and/or last date "${last_date}"`);
			});
			papa.parse<string[]>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				chunk: (results) => {
					if (first_chunk) { // Get the first timestamp
						first_date = results.data[1][header_index]; // The index is 1 to skip the header row
						first_chunk = false;
					}
					// Get the last timestamp of every chunk call, only the last one will be used
					if (results.data.length > 0)
						last_date = results.data.at(-1)![header_index];
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
	getData: function (file_name: string, header: number, comparator: (a: string, b: string) => number, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			const contents: TracyData[] = [];
			const stream = fs.createReadStream(file_name);
			// The parser does not have a completion call, so use the stream to do so
			stream.addListener("close", () => {
				if (contents.length > 0) resolve(contents);
				else reject(`problem with contents, length is 0`);
			});
			papa.parse<TracyData>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				header: true,
				chunk: (results) => {
					const header_field = results.meta.fields![header];
					results.data.forEach((row) => {
						const timestamp_string = row[header_field];
						// If within the timestamp constraints, then add it to the contents
						if (comparator(constraints[0], timestamp_string) <= 0 && comparator(timestamp_string, constraints[1]) <= 0)
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

// For backwards compatability
const TracyStringStandardConverter: FTracyConverter = {
	old_converter: standardConvert, // Just put the old version here
	getHeaders: function (file_name: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then((doc) => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				if (data.length === 0) return reject("Converter could not convert");
				const headers = Object.keys(data[0]);
				resolve(headers);
			}, (error) => {
				reject(error);
			});
		});
	},
	getTimestamps: function (file_name: string, header: number): Promise<[string, string]> {
		return new Promise<[string, string]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then((doc) => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				const headers = Object.keys(data[0]);
				if (data.length === 0) return reject("Converter could not convert");
				resolve([data[0][headers[header]], data.at(-1)![headers[header]]]); // return the time values of the first and last entry
			}, (error) => {
				reject(error);
			});
		});
	},
	getData: function (file_name: string, header: number, comparator: (a: string, b: string) => number, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then(doc => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				if (data.length === 0) return reject("Converter could not convert");
				const time_header = Object.keys(data[0])[header];
				// filter the data, remove the entries not within the set time range
				resolve(data.filter(entry => (comparator(constraints[0], entry[time_header]) <= 0 && comparator(entry[time_header], constraints[1]) <= 0)));
			}, (error) => {
				reject(error);
			});
		});
	}
}

export const NEW_CONVERTERS: {[s: string]: FTracyConverter} = {
	"Papa stream parser": TracyStreamPapaparser,
	"Using standard converter": TracyStringStandardConverter,
};

export function getHeaders(file_names: string[], converters: string[]): Promise<string[][]> {
	return Promise.all(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getHeaders(file_name);
	}));
}

export function getTimestamps(file_names: string[], converters: string[], headers: number[]) {
	console.log(converters, headers);
	return Promise.all(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getTimestamps(file_name, headers[index]);
	}));
}

export function getConversion(file_names: string[], converters: string[], headers: number[], comparator: (a: string, b: string) => number, constraints: [string, string]) {
	return Promise.all(file_names.map((file_name, index) => {
		return NEW_CONVERTERS[converters[index]].getData(file_name, headers[index], comparator, constraints);
	}));
}

// Define converters here
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
	const to_be_sorted = rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
	if (sort_by_column) return to_be_sorted.sort((a: TracyData, b: TracyData) => {
		return a[sort_by_column] > b[sort_by_column] ? 1 : -1;
	});
	return to_be_sorted;
}

/**
 * Returns a likely candidate for a CSV file's column delimiter.
 * @param content A slice of CSV content that contains multiple rows. The bigger the slice, the more accurate this function becomes.
 * @param row_delimiter The row delimiter, default='\n'.
 * @returns A char which is occurs the same amount of times in each row.
 */
export function getColumnDelimiter(content: string, row_delimiter: string = '\n') {
	// this function assumes that the row delimiter is a newline
	// will start simple by checking the amount of chars of each row and checking if they are the same
	const rows = content.slice(0, content.lastIndexOf(row_delimiter)) // ensure only checking complete rows
		.split(row_delimiter).filter((l)=> l.trim() !== '');
	
	const char_counts = rows.map((row: string) => {
		// get the char count of a row
		let count: {[s: string]: number} = {};
		[...row].forEach(char => {
			if (!(char in count)) count[char] = 0;
			count[char] = count[char] + 1;
		});
		return count;
	});

	// only keep the chars that are present in each row, and occur the same amount of times
	const shared_char_counts = char_counts.reduce((prev_row, current_row) => {
		let intersect_chars: {[s: string]: number} = {};
		for (const char in prev_row) {
			if (current_row[char] === prev_row[char]) intersect_chars[char] = prev_row[char]; // keep only the chars that both rows have
		}
		return intersect_chars;
	});
	// console.log("Found delimiters: ", shared_char_counts);
	const shared_chars = Object.keys(shared_char_counts);
	if (shared_chars.length > 0) return shared_chars[0]; // TODO: is there a better way to get the option than taking the first char?
	// TODO: ask user what delimiter to use (show example text maybe?), instead of giving a default
	return ','; // if no shared character is found, return the default delimiter
}

/**
 * Automatic CSV converter.
 * @param content CSV file contents, with '\n' as the row delimiter.
 * @returns Tracy json of the input
 */
function autoCSVConverter(content: string): TracyData[] {
	// Only use a slice of the string to compute the column delimiter, on account of efficiency
	const col_delimiter = getColumnDelimiter(content.slice(0, Math.min(5000, content.length)));
	const rows = content.split('\n').filter((l) => l.trim() !== '').map((l) => l.split(col_delimiter));
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
}

// List all converters here, key will be the name, value is the converter function
export const CONVERTERS: {[s: string]: (content: string, ...args: any[]) => TracyData[]} = {
	'Auto converter'			: autoCSVConverter,
	'Using standard converter' 	: standardConvert,
	'Define custom converter' 	: customSingleConverter, // name is used in extension.ts and ConverterReactPanel.ts
}
// List all comparators here, key will be the name, value is the comparator function
export const COMPARATORS: {[s: string]: (a: string, b: string) => number} = {
	"String compare"		: (a: string, b: string) => a.localeCompare(b), // negative if smaller
	"Date compare"			: (a, b) => (new Date(a).getTime() - new Date(b).getTime()),
	"dayjs compare"			: (a, b) => (dayjs(a).valueOf() - dayjs(b).valueOf()),
}

/**
 * Combines and converts multiple CSV files into a single tracy file.
 * @param files The contents of the CSV files.
 * @param sort_column The column the multiple files will be sorted by.
 * @param comparator The comparator function for the sorting of the sort column.
 * @returns A single tracy object array.
 */
// TODO: could possibly combine the comparator and the sort_column
export function multiCSVtoTracyConverter(files: string[], sort_column: string = "timestamp", comparator: (a: string, b: string) => number = COMPARATORS["String compare"]) : TracyData[] {
	// TODO: add multiple different headers options
	const tracy_docs = files.map(content => autoCSVConverter(content));
	// combine the files
	return multiTracyCombiner(tracy_docs, Array(files.length).fill(sort_column), comparator);
}

/**
 * Combines multiple instances of tracy object arrays.
 * @param contents The contents of the CSV files in tracy format.
 * @param sort_headers The headers that will be compared to each other for sorting the data.
 * @param comparator The comparator function for the sorting.
 * @returns A single tracy object array.
 */
export function multiTracyCombiner(contents: TracyData[][], sort_headers: string[], comparator: (a: string, b: string) => number = COMPARATORS["String compare"]) : TracyData[] {

	// Combine all headers
	const all_headers_array = Object.keys(contents.map(tracy_array => tracy_array[0]).reduce((prev, curr) => {
		return {...prev, ...curr};
	}));
	let all_headers: TracyData = {};
	all_headers_array.forEach((key) => { all_headers[key] = ""; });
	

	return contents.reduce((prev, current, index) => {
		// assumption is that the "timestamp"s are already sorted in both prev and current
		// this means an insertion sort/merge is efficient
		let prev_index = 0;
		let current_index = 0;
		let output: TracyData[] = [];
		while (prev_index < prev.length || current_index < current.length) {
			if (prev_index === prev.length) output.push({ ...all_headers, ...current[current_index++] });
			else if (current_index === current.length) output.push({ ...all_headers, ...prev[prev_index++] });
			else if (comparator(prev[prev_index][sort_headers[index - 1]], current[current_index][sort_headers[index]]) > 0) {
				output.push({ ...all_headers, ...prev[prev_index++] });
				prev_index++;
			} else {
				output.push({ ...all_headers, ...current[current_index++] });
				current_index++;
			}
		}
		return output;
	});
}
