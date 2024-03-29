import { ReadStream } from "fs";
import { FileMetaData, FileMetaDataOptions, TracyData } from "./communicationProtocol";
import { FTracyConverter, TIMESTAMP_HEADER_INDEX } from "./converters";
import { parseDateString } from "./utility";
import { FILE_NAME_HEADER, RESOLVED_TIMESTAMP_FORMAT, RESOLVED_TIMESTAMP_HEADER } from "./constants";
import { checkInsufficientFileSizeData } from "./fileSizeEstimator";

export class ConversionHandler {
	private metaDataCache: Map<string, [number, FileMetaData]>;

	private converters: {[s: string]: FTracyConverter<string> | FTracyConverter<ReadStream>};

	private fileLastModChecker: (s: string) => number;

	constructor(lastModChecker: (s: string) => number) {
		// Init cache
		this.metaDataCache = new Map();
		// Populate converters array
		this.converters = {};

		this.fileLastModChecker = lastModChecker;
	}

	/**
	 * Clears the stored converters and cache.
	 */
	public clear() {
		this.converters = {};
		this.metaDataCache.clear();
	}

	/**
	 * Adds a converter function to the conversion handler.
	 * @param name The name to display to the user.
	 * @param converterFunction The converter object.
	 */
	public addConverter(name: string, converterFunction: FTracyConverter<string> | FTracyConverter<ReadStream>) {
		this.converters[name] = converterFunction;
	}

	/**
	 * Get the converter object.
	 * @param name The display name of the converter.
	 * @returns The converter object.
	 */
	public getConverter(name: string) {
		return this.converters[name];
	}

	/**
	 * Gets the cached metadata if it exists and the file hasn't changed in the meantime.
	 * @param fileName The name of the file.
	 * @param converter The converter to use. (Because switch wrong converter needs to return the bad.)
	 * @returns The cached metadata or undefined
	 */
	private getCachedMetadata(fileName: string, converter: string, options: Partial<FileMetaDataOptions>): FileMetaData | undefined {
		const lastModification = this.fileLastModChecker(fileName);
		const cached = this.metaDataCache.get(`${fileName}:${converter}:${JSON.stringify(options)}`);
		if (cached && cached[0] === lastModification) {
			return cached[1];
		}
		return undefined;
	}

	private setCachedMetadata(fileName: string, converter: string, options: Partial<FileMetaDataOptions>, metadata: FileMetaData) {
		this.metaDataCache.set(`${fileName}:${converter}:${JSON.stringify(options)}`, [this.fileLastModChecker(fileName), metadata]);
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
	public getMetadata(fileNames: string[], converters: string[], options: Partial<FileMetaDataOptions>): Promise<PromiseSettledResult<FileMetaData>[]> {
		return Promise.allSettled(fileNames.map(async (fileName, index) => {
			// Beforehand filters
			if (fileName.endsWith(".zip")) return Promise.reject("Cannot read zip files.");

			// Check if in cache
			const cached = this.getCachedMetadata(fileName, converters[index], options);
			if (cached) return Promise.resolve(cached);

			const converter = this.converters[converters[index]];
			return converter.fileReader(fileName).then(fileData => converter.getMetadata(fileData as never, {...options, fileName})).then(fmd => {
				// Add extra errors/Filter output
				if (fmd.headers.length <= 1) return Promise.reject("Insufficient headers. Wrong format?");
				if (parseDateString(fmd.headers[TIMESTAMP_HEADER_INDEX]).isValid()) return Promise.reject("First header seems to be a timestamp. Does the input have headers?");
				if (checkInsufficientFileSizeData(fmd)) return Promise.reject("Could not get file size data.");
				// set in cache
				this.setCachedMetadata(fileName, converters[index], options, fmd);
				return fmd;
			});
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
		return Promise.allSettled(fileNames.map((fileName, index) => {
			const converter = this.converters[converters[index]];
			return converter.fileReader(fileName).then(fileData => converter.getData(fileData as never, constraints)).then(arr => arr.map(v => {
				// add file name to output
				v[FILE_NAME_HEADER] = fileName;
				// add resolved timestamps
				v[RESOLVED_TIMESTAMP_HEADER] = parseDateString(v[Object.keys(v)[TIMESTAMP_HEADER_INDEX]]).format(RESOLVED_TIMESTAMP_FORMAT);
				return v;
			}));
		}));
	}
}