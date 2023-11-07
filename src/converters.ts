import fs from 'fs';
import papa from 'papaparse';
import vscode from 'vscode';
import { XMLParser } from "fast-xml-parser";
import { FileMetaData, FileMetaDataOptions, TracyData } from './communicationProtocol';
import { DEFAULT_COMPARATOR, escapeRegExp } from './utility';
import { DEFAULT_TERM_SEARCH_INDEX } from './constants';
import { gatherSizeData } from './fileSizeEstimator';

export const TIMESTAMP_HEADER_INDEX = 0;

export interface FTracyConverter<T> {
	/**
	 * Gets the metadata of the file.
	 * @param fileData The name of the file.
	 * @returns The metadata of the file.
	 */
	getMetadata: (fileData: T, options: Partial<FileMetaDataOptions> & { fileName: string }) => Promise<FileMetaData>;

	/**
	 * Opens and converts the given file, only returns the rows/entries that have a time/id between the given constraints.
	 * @param fileData The name of the file that is to be converted.
	 * @param header The header that denotes the time/id of the row/entry.
	 * @param constraints A tuple containing values used for filtering the output, they are compared using the comparator.
	 * @returns A promise of the resulting tracy object array.
	 */
	getData: (fileData: T, constraints?: [string, string]) => Promise<TracyData[]>;

	/**
	 * This is an optional parameter, allows a FTracyConverter to reduce code duplication via shared processing. Not useful for stream processing.
	 * @param content A string containing all the text of a file.
	 * @returns A tracy object array;
	 */
	sharedConverter?: (content: T) => TracyData[];

	/**
	 * An optional parameter, allows a FTracyConverter to reduce code duplication via shared processing. Primarily useful for stream processing.
	 * @param content The stream to parse.
	 * @param callback The callback for each array of TracyData that the stream produces.
	 * @param complete The optional callback which allows the streamConverter to return the final product.
	 */
	streamConverter?: (content: T, callback: (data: TracyData[]) => void, complete?: () => void) => void;

	/**
	 * File reader that is used to get the (meta)data.
	 * @param fileName The file to read
	 * @returns A promise of either a string of a stream depending on the type of converter.
	 */
	fileReader: (fileName: string) => Promise<T>;
}

const STREAM_FS_READER = async (fileName: string) => {
	return fs.createReadStream(fileName);
};

const STRING_FS_READER = async (fileName: string) => {
	return fs.promises.readFile(fileName, "utf-8");
}

const STRING_VSC_READER = async (fileName: string) => {
	return vscode.workspace.openTextDocument(fileName).then(doc => doc.getText());
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
/**
 * Flattens all the objects of the given `obj` and put them into the `outObj`.
 * @param outObj The object all nested objects give their key value pairs to.
 * @param obj The object that may or may not have a nested object at the specified header.
 * @param header The header of the object to parse through.
 */
const flattenObjects = (outObj: TracyData, obj: never, header: string) => {
	if (typeof obj[header] === "object") {
		Object.keys(obj[header]).map(e => flattenObjects(outObj, obj[header], e))
	} else if (obj[header] !== "") {
		outObj[header] = obj[header];
	}
}
/**
 * Populate the given metadata object with the given TracyData entries.
 * @param entries The entries to crawl through/parse for the metadata.
 * @param inputMetadata The previous metadata object, use then when streaming the input file. Otherwise the file name.
 * @param options The options for parsing the FileMetaData
 * @throws A string describing the error that has occurred.
 * @returns The new metadata object.
 */
function entryCrawler(entries: TracyData[], options: Partial<FileMetaDataOptions> & { fileName: string }, inputMetadata?: FileMetaData): FileMetaData {
	const metadata: FileMetaData = inputMetadata ?? {
		fileName: "",
		headers: [],
		firstDate: '',
		lastDate: '',
		fileSizeData: { indices: [] },
		termOccurrances: []
	};

	const headers = Object.keys(entries[0]);
	if (!metadata.headers || metadata.headers.length === 0) {
		// This runs only the first time
		metadata.fileName = options.fileName;
		metadata.headers = headers;
		metadata.firstDate = entries[0][metadata.headers[TIMESTAMP_HEADER_INDEX]];

		metadata.termOccurrances = options.terms?.map(t => [t[0], 0]) ?? []; // Prepopulate
	} else if (headers.length !== metadata.headers.length) { // If not the same amount of headers
		// TODO: is it faster to check for unequal amounts of headers or just adding them all to a Set
		metadata.headers = [... new Set(metadata.headers.concat(headers))];
	}
	
	// Check if last date is actually latest date
	const newLastDate = entries.at(-1)![metadata.headers[TIMESTAMP_HEADER_INDEX]];
	if (DEFAULT_COMPARATOR(metadata.lastDate, newLastDate) < 0 || metadata.lastDate === "") metadata.lastDate = newLastDate;

	// FileSizeEstimator gather necessary data
	metadata.fileSizeData = gatherSizeData(entries, metadata);
	
	// Check the terms
	const headerIndexToCheck = options.termSearchIndex ? options.termSearchIndex[options.fileName] : DEFAULT_TERM_SEARCH_INDEX;
	
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
export const CONVERTERS: {[s: string]: FTracyConverter<string> | FTracyConverter<fs.ReadStream>} = {
	// This is the default converter. It uses streams to convert CSV files. Better for large files.
	TRACY_STREAM_PAPAPARSER: {
		fileReader: STREAM_FS_READER,
		streamConverter: function (stream, callback, complete) {
			papa.parse<TracyData>(stream, {
				chunkSize: PARSER_CHUNK_SIZE,
				header: true,
				chunk: (results) => {
					if (results.data.length > 0) {
						callback(results.data);
					}
				},
				error: (error: Error) => { throw error; },
				complete: complete ?? (() => {})
			});
		},
		getMetadata: function (stream, options): Promise<FileMetaData> {
			return new Promise<FileMetaData>((resolve, reject) => {
				let metadata: FileMetaData;
				this.streamConverter!(stream, (data) => {
					try {
						// Crawl through data
						metadata = entryCrawler(data, options, metadata);
					} catch(e) {
						// If crawling generates an error
						reject(e);
					}
				}, () => {
					if (typeof metadata !== "string") resolve(metadata);
					else reject(`problem with obtaining metadata: ${metadata}`);
				});
			});
		},
		getData: function (stream, constraints): Promise<TracyData[]> {
			return new Promise<TracyData[]>((resolve, _reject) => {
				const contents: TracyData[] = [];
				this.streamConverter!(stream, (data) => {
					const headerField = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
					data.forEach((row) => {
						const timestampString = row[headerField];
						// If within the timestamp constraints, then add it to the contents
						if (!constraints 
							|| DEFAULT_COMPARATOR(constraints[0], timestampString) <= 0 
							&& DEFAULT_COMPARATOR(timestampString, constraints[1]) <= 0) {
							contents.push(row);
						}
					})
				}, () => {
					resolve(contents);
				});
			});
		}
	} as FTracyConverter<fs.ReadStream>,

	// Deprecated converter, only used now for testing purposes.
	TRACY_STRING_STANDARD_CONVERTER: {
		sharedConverter: standardConvert,
		fileReader: STRING_VSC_READER,
		getMetadata: async function (fileData, options): Promise<FileMetaData> {
			const data = this.sharedConverter!(fileData as string);
			if (data.length === 0) return Promise.reject("Converter could not convert.");

			// Crawl through data
			return entryCrawler(data, options);
		},
		getData: async function (fileData, constraints): Promise<TracyData[]> {
			const data = this.sharedConverter!(fileData as string); // convert with the legacy converter
			if (data.length === 0) return Promise.reject("Converter could not convert");
			const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
			// filter the data, remove the entries not within the set time range
			return data.filter(entry => (!constraints 
				|| DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0 
				&& DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0));
		}
	} as FTracyConverter<string>,

	// Deprecated converter, only used now for testing purposes.
	TRACY_STRING_XML: {
		fileReader: STRING_VSC_READER,
		sharedConverter: (content) => {
			const obj = xmlParser.parse(content);
			// The [1] is to ignore the <?xml version>, Tracy doesn't care which system the event log came from, so it is not specified.
			return (obj[Object.keys(obj)[1]]["EventLog"]["Event"] as Array<never>).map(v => { // For all events in the <eventlog>
				const outObj: TracyData = { "TimeStamp": v["TimeStamp"] + "." + v["TimeFraction"] }; // Get the timestamp
				Object.keys(v).filter(f => f !== "Index" && f !== "TimeFraction" && f !== "TimeStamp") // Remove the timestamp and index keys
				.forEach(h => flattenObjects(outObj, v, h)); // Then flatten the event
				return outObj;
			});
		},
		getMetadata: async function (content, options): Promise<FileMetaData> {
			const data = this.sharedConverter!(content);
			if (data.length === 0) throw "Converter could not convert.";
			
			// Crawl through data
			return entryCrawler(data, options);
		},
		getData: async function (content, constraints): Promise<TracyData[]> {
			const data = this.sharedConverter!(content as string); // convert with the legacy converter
			if (data.length === 0) return Promise.reject("Converter could not convert");
			const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
			// filter the data, remove the entries not within the set time range
			return data.filter(entry => (!constraints
				|| DEFAULT_COMPARATOR(constraints[0], entry[timeHeader]) <= 0 
				&& DEFAULT_COMPARATOR(entry[timeHeader], constraints[1]) <= 0));
		}
	} as FTracyConverter<string>,

	TRACY_STREAM_XML: {
		fileReader: STREAM_FS_READER,
		streamConverter: function (stream, callback) {
			let unparsedBuffer: string = "";
			const startString = "<Event ";
			const endString = "</Event>";
			stream.on("data", (chunk) => {
				unparsedBuffer += chunk;
				// Get only complete xml strings
				const readUntilIndex = unparsedBuffer.lastIndexOf(endString);
				if (readUntilIndex === -1) return;
				const xmlChunkStart = unparsedBuffer.slice(0, readUntilIndex + endString.length);
				const readFromIndex = xmlChunkStart.indexOf(startString);
				const xmlChunkComplete = xmlChunkStart.slice(readFromIndex)
				
				// Parse the xml string
				const out = xmlParser.parse(xmlChunkComplete);
				const tracyData = (out["Event"] as never[]).map(v => { // For all events in the <eventlog>
					const outObj: TracyData = { "TimeStamp": v["TimeStamp"] + "." + v["TimeFraction"] }; // Get the timestamp
					Object.keys(v).filter(f => f !== "Index" && f !== "TimeFraction" && f !== "TimeStamp") // Remove the timestamp and index keys
					.forEach(h => flattenObjects(outObj, v, h)); // Then flatten the event
					return outObj;
				}); // TODO: fix not having headers [processid and threadid]

				// Update the metadata
				callback(tracyData);

				// Update the unparsed buffer
				unparsedBuffer = unparsedBuffer.slice(readUntilIndex + endString.length);
			});
		},
		getMetadata: async function (stream, options): Promise<FileMetaData> {
			return new Promise((resolve, reject) => {
				let metadata: FileMetaData;
				this.streamConverter!(stream, (data) => {
					// Update the metadata
					try {
						metadata = entryCrawler(data, options, metadata);
					} catch (e) {
						reject(e);
					}
				});

				stream.on("end", () => {
					resolve(metadata);
				});
				stream.on("error", (err) => reject(err));
			});
		},
		getData: async function (stream, constraints): Promise<TracyData[]> {
			return new Promise((resolve, reject) => {
				const tracyData: TracyData[] = [];
				this.streamConverter!(stream, (data) => {
					const timeHeader = Object.keys(data[0])[TIMESTAMP_HEADER_INDEX];
					data.forEach((row) => {
						const timestampString = row[timeHeader];
						// If within the timestamp constraints, then add it to the contents
						if (!constraints 
							|| DEFAULT_COMPARATOR(constraints[0], timestampString) <= 0 
							&& DEFAULT_COMPARATOR(timestampString, constraints[1]) <= 0) {
							tracyData.push(row);
						}
					})
				});
				stream.on("end", () => {
					resolve(tracyData);
				});
				stream.on("error", (err) => reject(err));
			});
		}
	} as FTracyConverter<fs.ReadStream>,
	
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
