import fs from 'fs';
import papa from 'papaparse';
import vscode from 'vscode';
import { FileMetaData, FileMetaDataOptions } from './communicationProtocol';
import { escapeRegExp, parseDateString } from './utility';
import { DEFAULT_TERM_SEARCH_INDEX } from './constants';

export const TIMESTAMP_HEADER_INDEX = 0;
/**
 * Compare the values of a and b
 * @param a Date string a.
 * @param b Date string b.
 * @returns Negative if a is before b. Equal if at the same time. Positive if later.
 */
export const DEFAULT_COMPARATOR = (a: string, b: string) => (parseDateString(a).valueOf() - parseDateString(b).valueOf());

export type TracyData = {[s: string]: string};

export interface FTracyConverter<T> {
	/**
	 * Gets the metadata of the file.
	 * @param fileData The name of the file.
	 * @returns The metadata of the file.
	 */
	getMetadata: (fileData: T, options: Partial<FileMetaDataOptions>) => Promise<FileMetaData>;

	/**
	 * Opens and converts the given file, only returns the rows/entries that have a time/id between the given constraints.
	 * @param fileData The name of the file that is to be converted.
	 * @param header The header that denotes the time/id of the row/entry.
	 * @param constraints A tuple containing values used for filtering the output, they are compared using the comparator.
	 * @returns A promise of the resulting tracy object array.
	 */
	getData: (fileData: T, constraints?: [string, string]) => Promise<TracyData[]>;

	/**
	 * This is an optional parameter, it should only be used when one wants to reuse one of the old converters.
	 * @param content A string containing all the text of a CSV file.
	 * @returns A tracy object array;
	 */
	oldConverter?: (content: string) => TracyData[];

	/**
	 * File reader that is used to get the (meta)data.
	 * @param fileName The file to read
	 * @returns A promise of either a string of a stream depending on the type of converter.
	 */
	fileReader: (fileName: string) => Promise<T>;
};

const STREAM_FS_READER = async (fileName: string) => {
	return fs.createReadStream(fileName);
};

const STRING_FS_READER = async (fileName: string) => {
	return fs.promises.readFile(fileName, "utf-8");
}

const STRING_VSC_READER = async (fileName: string) => {
	return vscode.workspace.openTextDocument(fileName).then(doc => doc.getText());
}

/**
 * Populate the given metadata object with the given TracyData entries.
 * @param entries The entries to crawl through/parse for the metadata.
 * @param inputMetadata The previous metadata object, use then when streaming the input file. Otherwise the file name.
 * @param options The options for parsing the FileMetaData
 * @throws A string describing the error that has occurred.
 * @returns The new metadata object.
 */
function entryCrawler(entries: TracyData[], options: Partial<FileMetaDataOptions>, inputMetadata?: FileMetaData): FileMetaData {
	const metadata: FileMetaData = inputMetadata ?? {
		fileName: "",
		headers: [],
		firstDate: '',
		lastDate: '',
		dataSizeIndices: [],
		termOccurrances: []
	};

	if (!metadata.headers || metadata.headers.length === 0) {
		// This runs only the first time
		metadata.headers = Object.keys(entries[0]);
		metadata.firstDate = entries[0][metadata.headers[TIMESTAMP_HEADER_INDEX]];

		metadata.termOccurrances = options.terms?.map(t => [t[0], 0]) ?? []; // Prepopulate
	}
	
	// Check if last date is actually latest date
	const newLastDate = entries.at(-1)![metadata.headers[TIMESTAMP_HEADER_INDEX]];
	if (DEFAULT_COMPARATOR(metadata.lastDate, newLastDate) < 0 || metadata.lastDate === "") metadata.lastDate = newLastDate;

	// Keep track of the amount of data passing through per time this function is called
	metadata.dataSizeIndices.push([metadata.lastDate, entries.length]);
	
	// Check the terms
	const headerIndexToCheck = options.termSearchIndex ? options.termSearchIndex[metadata.fileName] : DEFAULT_TERM_SEARCH_INDEX;
	
	options.terms?.forEach(([str, flags], i) => {
		// Its easier to have it always be a regular expression
		const wsStart = flags.wholeSearch ? "(?:^|\s)" : ""; // Match only words that either start the string of have a whitespace in front
		const wsEnd = flags.wholeSearch ? "(?:$|\s)" : ""; // Match only words that end the string or have a whitespace after it
		const maybeEscapedString = flags.reSearch ? str : escapeRegExp(str); // escape all special symbols
		const regex = new RegExp(`${wsStart}${maybeEscapedString}${wsEnd}`, `g${(!flags.caseSearch ? "i" : "")}`);
		// edit the metadata, the following statement finds the amount of matches of 'regex' in each value of each entry and sums them up
		metadata.termOccurrances[i][1] += entries.map(val => {
			const headerToCheck = Object.keys(val).at(headerIndexToCheck >= 0 ? headerIndexToCheck : DEFAULT_TERM_SEARCH_INDEX) ?? "";
			if (headerToCheck === "") throw "Cannot find header at " + headerIndexToCheck;
			const stringToCheck = (val[headerToCheck]) ?? "";
			if (typeof stringToCheck !== "string") throw "Tried to match non-string. Wrong format?";
			return (stringToCheck.match(regex) || []).length;
		}).reduce((p, c) => p + c);
	});

	return metadata;
}

const PARSER_CHUNK_SIZE = 1024; // I don't know how big we want this
export const NEW_CONVERTERS: {[s: string]: FTracyConverter<string> | FTracyConverter<fs.ReadStream>} = {
	// This is the default converter. It uses streams to convert CSV files. Better for large files.
	TRACY_STREAM_PAPAPARSER: {
		fileReader: STREAM_FS_READER,
		getMetadata: function (stream, options: Partial<FileMetaDataOptions>): Promise<FileMetaData> {
			return new Promise<FileMetaData>((resolve, reject) => {
				let metadata: FileMetaData;

				papa.parse<TracyData>(stream, {
					chunkSize: PARSER_CHUNK_SIZE,
					header: true,
					chunk: (results) => {
						if (results.data.length > 0) {
							try {
								// Crawl through data
								metadata = entryCrawler(results.data, options, metadata);
							} catch(e) {
								// If crawling generates an error
								reject(e);
							}
						}
					},
					error: (error: Error) => reject(error),
					complete: () => {
						if (typeof metadata !== "string") resolve(metadata);
						else reject(`problem with obtaining metadata: ${metadata}`);
					}
				});
			});
		},
		getData: function (stream, constraints): Promise<TracyData[]> {
			return new Promise<TracyData[]>((resolve, reject) => {
				const contents: TracyData[] = [];
				// The parser does not have a completion call, so use the stream to do so
				papa.parse<TracyData>(stream, {
					chunkSize: PARSER_CHUNK_SIZE,
					header: true,
					chunk: (results) => {
						const headerField = results.meta.fields![TIMESTAMP_HEADER_INDEX];
						results.data.forEach((row) => {
							const timestampString = row[headerField];
							// If within the timestamp constraints, then add it to the contents
							if (!constraints 
								|| DEFAULT_COMPARATOR(constraints[0], timestampString) <= 0 
								&& DEFAULT_COMPARATOR(timestampString, constraints[1]) <= 0) {
								contents.push(row);
							}
						})
					},
					error: (error: Error) => {
						reject(error);
					},
					complete: () => {
						resolve(contents);
					}
				});
			});
		}
	} as FTracyConverter<fs.ReadStream>,

	// For backwards compatability. This is an example of how the old parser/converter implementations can be reused.
	TRACY_STRING_STANDARD_CONVERTER: {
		oldConverter: standardConvert, // Just put the old version here
		fileReader: STRING_VSC_READER,
		getMetadata: async function (fileData, options): Promise<FileMetaData> {
			const data = this.oldConverter!(fileData as string);
			if (data.length === 0) return Promise.reject("Converter could not convert.");

			// Crawl through data
			return entryCrawler(data, options);
		},
		getData: async function (fileData, constraints): Promise<TracyData[]> {
			const data = this.oldConverter!(fileData as string); // convert with the legacy converter
			if (data.length === 0) return Promise.reject("Converter could not convert");
			const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
			// filter the data, remove the entries not within the set time range
			return data.filter(entry => (!constraints 
				|| DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0 
				&& DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0));
		}
	} as FTracyConverter<string>,

	TRACY_JSON_READER: {
		fileReader: STRING_FS_READER,
		getMetadata: async function (fileData, options): Promise<FileMetaData> {
			// Read the json file
			const data = JSON.parse(fileData as string) as TracyData[];
			if (data.length === 0) return Promise.reject("Converter could not convert.");

			// Crawl through data
			return entryCrawler(data, options);
		},
		getData: async function (fileData, constraints): Promise<TracyData[]> {
			const data = JSON.parse(fileData as string) as TracyData[];
			if (data.length === 0) return Promise.reject("Converter could not convert");
			const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
			// filter the data, remove the entries not within the set time range
			return data.filter(entry => (!constraints
				|| DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0
				&& DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0));
		}
	} as FTracyConverter<string>,

	TRACY_XML: {
		fileReader: STRING_FS_READER,
		getMetadata: function (): Promise<FileMetaData> {
			throw new Error('Function not implemented.');
		},
		getData: function (): Promise<TracyData[]> {
			throw new Error('Function not implemented.');
		}
	} as FTracyConverter<string>,
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
 * @param colDelimiter The column delimiter of the CSV file.
 * @param rowDelimiter The row delimiter of the CSV file.
 * @param sortByColumn The column to sort by.
 * @returns A tracy object.
 */
function customSingleConverter(content: string, colDelimiter: string = ',', rowDelimiter: string = '\n', sortByColumn: string | undefined) {
	const rows = content.split(rowDelimiter) // split by row delimiter
		.filter((l) => l.trim() !== '') // remove leading and trailing whitespace
		.map((l) => l.split(colDelimiter)); // split by column delimiter and copy to new array
	const headers = rows[0];
	const toBeSorted = rows.slice(1).map((r) => {
		const row: TracyData = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
	if (sortByColumn) return toBeSorted.sort((a: TracyData, b: TracyData) => {
		return a[sortByColumn] > b[sortByColumn] ? 1 : -1;
	});
	return toBeSorted;
}

/**
 * Returns a likely candidate for a CSV file's column delimiter.
 * @deprecated since v0.0.2 (in which it appeared)
 * @param content A slice of CSV content that contains multiple rows. The bigger the slice, the more accurate this function becomes.
 * @param rowDelimiter The row delimiter, default='\n'.
 * @returns A char which is occurs the same amount of times in each row.
 */
function getColumnDelimiter(content: string, rowDelimiter: string = '\n') {
	// this function assumes that the row delimiter is a newline
	// will start simple by checking the amount of chars of each row and checking if they are the same
	const rows = content.slice(0, content.lastIndexOf(rowDelimiter)) // ensure only checking complete rows
		.split(rowDelimiter).filter((l)=> l.trim() !== '');
	
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
	const sharedCharCounts = charCounts.reduce((prevRow, currentRow) => {
		const intersectChars: {[s: string]: number} = {};
		for (const char in prevRow) {
			if (currentRow[char] === prevRow[char]) intersectChars[char] = prevRow[char]; // keep only the chars that both rows have
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
 * @returns A single tracy object array.
 */
export function multiTracyCombiner(contents: TracyData[][]) : TracyData[] {
	// Empty contents?
	contents = contents.filter(arr => arr.length > 0);
	// Combine all headers
	const allHeadersArray = Object.keys(contents.map(tracyArray => tracyArray[0]).reduce((prev, curr) => {
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
