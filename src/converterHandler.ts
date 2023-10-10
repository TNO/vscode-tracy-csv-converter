import { ReadStream } from "fs";
import { FileMetaData } from "./communicationProtocol";
import { FTracyConverter, TIMESTAMP_HEADER_INDEX, TracyData } from "./converters";
import { parseDateString } from "./utility";
import { FILE_NAME_HEADER, RESOLVED_TIMESTAMP_FORMAT, RESOLVED_TIMESTAMP_HEADER } from "./constants";

export class ConversionHandler {
	private metaDataCache: Map<string, [number, FileMetaData]>;

	private converters: {[s: string]: FTracyConverter<string | ReadStream>};

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
	 * @param converterFunction The converter function.
	 */
	public addConverter(name: string, converterFunction: FTracyConverter<string | ReadStream>) {
		this.converters[name] = converterFunction;
	}

	/**
	 * Gets the cached metadata if it exists and the file hasn't changed in the meantime.
	 * @param fileName The name of the file.
	 * @param converter The converter to use. (Because switch wrong converter needs to return the bad.)
	 * @returns The cached metadata or undefined
	 */
	private getCachedMetadata(fileName: string, converter: string): FileMetaData | undefined {
		const lastModification = this.fileLastModChecker(fileName);
		const cached = this.metaDataCache.get(`${fileName}:${converter}`);
		if (cached && cached[0] === lastModification) {
			return cached[1];
		}
		return undefined;
	}

	private setCachedMetadata(fileName: string, converter: string, metadata: FileMetaData) {
		this.metaDataCache.set(`${fileName}:${converter}`, [this.fileLastModChecker(fileName), metadata]);
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
			// Beforehand filters
			if (fileName.endsWith(".zip")) return Promise.reject("Cannot read zip files.");

			// Check if in cache
			const cached = this.getCachedMetadata(fileName, converters[index]);
			if (cached) return Promise.resolve(cached);

			return this.converters[converters[index]].getMetadata(fileName).then(fmd => {
				// Add extra errors/Filter output
				if (fmd.headers.length <= 1) return Promise.reject("Insufficient headers. Wrong format?");
				if (parseDateString(fmd.headers[TIMESTAMP_HEADER_INDEX]).isValid()) return Promise.reject("First header seems to be a timestamp. Does the input have headers?");
				if (fmd.dataSizeIndices.length === 0) return Promise.reject("Could not get size indices.");
				// set in cache
				this.setCachedMetadata(fileName, converters[index], fmd);
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
			return this.converters[converters[index]].getData(fileName, constraints).then(arr => arr.map(v => {
				// add file name to output
				v[FILE_NAME_HEADER] = fileName;
				// add resolved timestamps
				v[RESOLVED_TIMESTAMP_HEADER] = parseDateString(v[Object.keys(v)[TIMESTAMP_HEADER_INDEX]]).format(RESOLVED_TIMESTAMP_FORMAT);
				return v;
			}));
		}));
	}
}