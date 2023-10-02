import dayjs from 'dayjs';
import fs from 'fs';
import papa from 'papaparse';
import vscode from 'vscode';
import { FILE_NAME_HEADER } from './constants';
import { FileMetaData } from './communicationProtocol';

const TIMESTAMP_HEADER_INDEX = 0;
/**
 * Compare the values of a and b
 * @param a Date string a.
 * @param b Date string b.
 * @returns Negative if a is before b. Equal if at the same time. Positive if later.
 */
export const DEFAULT_COMPARATOR = (a: string, b: string) => (dayjs(a).valueOf() - dayjs(b).valueOf());

type TracyData = {[s: string]: string};

type FTracyConverter = {
	/**
	 * Gets the metadata of the file.
	 * @param fileName The name of the file.
	 * @returns The metadata of the file.
	 */
	getMetadata: (fileName: string) => Promise<FileMetaData>;

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
	getMetadata: function (fileName: string): Promise<FileMetaData> {
		return new Promise<FileMetaData>((resolve, reject) => {
			let firstChunk = true;
			const metadata: FileMetaData = {
				headers: [],
				firstDate: '',
				lastDate: '',
				dataSizeIndices: []
			};

			const stream: fs.ReadStream = fs.createReadStream(fileName);
			papa.parse<string[]>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				chunk: (results) => {
					if (firstChunk) {
						metadata.headers = results.data[0];
						metadata.firstDate = results.data[1][TIMESTAMP_HEADER_INDEX];
						firstChunk = false;
					}
					if (results.data.length > 0) {
						metadata.lastDate = results.data.at(-1)![TIMESTAMP_HEADER_INDEX];
						// Keep track of the amount of data passing through per time interval
						metadata.dataSizeIndices.push([metadata.lastDate, results.data.length]);
					}
				},
				error: (errorMsg) => reject(errorMsg),
				complete: () => {
					if (metadata) resolve(metadata);
					else reject(`problem with obtaining metadata: ${metadata}`);
				}
			});
		});
	},
	getData: function (file_name: string, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			const contents: TracyData[] = [];
			const stream = fs.createReadStream(file_name);
			// The parser does not have a completion call, so use the stream to do so
			papa.parse<TracyData>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				header: true,
				chunk: (results) => {
					const headerField = results.meta.fields![TIMESTAMP_HEADER_INDEX];
					results.data.forEach((row) => {
						const timestampString = row[headerField];
						// If within the timestamp constraints, then add it to the contents
						if (DEFAULT_COMPARATOR(constraints[0], timestampString) <= 0 && DEFAULT_COMPARATOR(timestampString, constraints[1]) <= 0) {
							contents.push(row);
						}
					})
				},
				error: (error) => {
					reject(error);
				},
				complete: () => {
					resolve(contents);
				}
			});
		});
	}
}

// For backwards compatability. This is an example of how the old parser/converter implementations can be reused.
const TRACY_STRING_STANDARD_CONVERTER: FTracyConverter = {
	old_converter: standardConvert, // Just put the old version here
	getMetadata: function (fileName: string): Promise<FileMetaData> {
		return new Promise((resolve, reject) => {
			vscode.workspace.openTextDocument(fileName).then(doc => {
				const data = this.old_converter!(doc.getText());
				if (data.length === 0) return reject("Converter could not convert.");
				const headers = Object.keys(data[0]);
				const metadata: FileMetaData = {
					headers: headers,
					firstDate: data[0][headers[TIMESTAMP_HEADER_INDEX]],
					lastDate: data.at(-1)![headers[TIMESTAMP_HEADER_INDEX]],
					dataSizeIndices: []
				};
				
				resolve(metadata);
			}, (errorMsg) => reject(errorMsg));
		});
	},
	getData: function (file_name: string, constraints: [string, string]): Promise<TracyData[]> {
		return new Promise<TracyData[]>((resolve, reject) => {
			vscode.workspace.openTextDocument(file_name).then(doc => { // open using vscode
				const data = this.old_converter!(doc.getText()); // convert with the legacy converter
				if (data.length === 0) return reject("Converter could not convert");
				const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
				// filter the data, remove the entries not within the set time range
				resolve(data.filter(entry => (DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0 && DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0))
					.map(td => {
						return td;
					})
				);
			}, (error) => {
				reject(error);
			});
		});
	}
}

const TRACY_IENGINE: FTracyConverter = {
	getMetadata: function (): Promise<FileMetaData> {
		return new Promise((_resolve, reject) => reject("Function not implemented."));
	},
	getData: function (): Promise<TracyData[]> {
		return new Promise((_resolve, reject) => reject('Function not implemented.'));
	}
}

export class Converter {
	private metaDataCache: Map<string, [number, FileMetaData]>;

	private converters: {[s: string]: FTracyConverter};

	constructor() {
		// Init cache
		this.metaDataCache = new Map();
		// Populate converters array
		this.converters = {};
		this.converters["CSV automatic"] = TRACY_STREAM_PAPAPARSER;
		this.converters["CSV standard (small files only)"] = TRACY_STRING_STANDARD_CONVERTER;
		this.converters["iEngine format"] = TRACY_IENGINE;
	}

	/**
	 * Gets the cached metadata if it exists and the file hasn't changed in the meantime.
	 * @param fileName The name of the file.
	 * @param converter The converter to use. (Because switch wrong converter needs to return the bad.)
	 * @returns The cached metadata or undefined
	 */
	private getCachedMetadata(fileName: string, converter: string): FileMetaData | undefined {
		const lastModification = fs.statSync(fileName).mtimeMs;
		const cached = this.metaDataCache.get(`${fileName}:${converter}`);
		if (cached && cached[0] === lastModification) {
			return cached[1];
		}
		return undefined;
	}

	private setCachedMetadata(fileName: string, converter: string, metadata: FileMetaData) {
		this.metaDataCache.set(`${fileName}:${converter}`, [fs.statSync(fileName).mtimeMs, metadata]);
	}

	public getConvertersList() {
		return Object.keys(this.converters);
	}

	public getConverterKey(index: number): string {
		return this.getConvertersList()[index];
	}

	/**
	 * Get the metadata of the input files.
	 * @param fileNames The names of the files from which to get the metadata.
	 * @param converters The converters, index bound to the file names, with which to get the metadata.
	 * @returns A promise for the metadata of the files, index bound to the file names.
	 */
	public getMetadata(fileNames: string[], converters: string[]): Promise<PromiseSettledResult<FileMetaData>[]> {
		return Promise.allSettled(fileNames.map(async (fileName, index) => {
			// Check if in cache
			const cached = this.getCachedMetadata(fileName, converters[index]);
			if (cached) return cached;

			const fmd = (await this.converters[converters[index]].getMetadata(fileName));
			// Add extra errors/Filter output
			if (fmd.headers.length <= 1) return Promise.reject("Insufficient headers. Wrong format?");
			// set in cache
			this.setCachedMetadata(fileName, converters[index], fmd);
			return fmd;
			
		}));
	}

	/**
	 * Convert the given files into tracy object arrays.
	 * @param fileNames The names of the files which should be converted.
	 * @param converters The converters, index bound to the file names, with which to convert the files.
	 * @param constraints A tuple containing values used for filtering the output, they are compared using the comparator.
	 * @returns An array of tracy object arrays.
	 */
	public getConversion(fileNames: string[], converters: string[], constraints: [string, string]): Promise<PromiseSettledResult<TracyData[]>[]> {
		return Promise.allSettled(fileNames.map(async (fileName, index) => {
			return (await this.converters[converters[index]].getData(fileName, constraints)).map(v => {
				v[FILE_NAME_HEADER] = fileName;
				return v;
			});
		}));
	}
	
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
	
	return contents.reduce((prev, current) => {
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
