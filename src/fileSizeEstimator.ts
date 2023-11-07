import { FileMetaData, PerFileSizeData, TracyData } from "./communicationProtocol";
import { FILE_NAME_HEADER, RESOLVED_TIMESTAMP_FORMAT, RESOLVED_TIMESTAMP_HEADER } from "./constants";
import { DEFAULT_COMPARATOR, parseDateString } from "./utility";

export interface FileSizeEstimator {
    clear(): void;
    addFile(file: string, metadata: FileMetaData): void;
    estimateSize(from: string, to: string): number;
}

type TracyFileSizeData = {
    start: string;
    // timestamp, size, bytes of chunk
    indices: [string, number, number][];
    bytesOfHeaders: number;
}

/**
 * Gathers the file data necessary to estimate the file size.
 * @param entries The entries to be analyzed.
 * @param metadata The current metadata of the file.
 * @returns The file size data of the file.
 */
export function gatherSizeData(entries: readonly TracyData[], metadata: FileMetaData): PerFileSizeData {
    metadata.fileSizeData.indices.push([
		metadata.lastDate,
		entries.length,
		entries.map(v => Object.keys(v).map(h => v[h].length).reduce((a, b) => a + b)).reduce((a, b) => a + b),
	]);
    return metadata.fileSizeData;
}

/**
 * Checks whether the file metadata has been gathered correctly for the file size estimator.
 * @param metadata The metadata of the file.
 * @returns Whether the file size data is sufficient to estimate the file size.
 */
export function checkInsufficientFileSizeData(metadata: FileMetaData): boolean {
    return metadata.fileSizeData.indices.length === 0;
}

export class TracyFileSizeEstimator implements FileSizeEstimator {
    // Keep the amount of indices per time range and the 
    
    private files: { [s: string]: TracyFileSizeData };
    constructor() {
        this.files = {};
    }
    clear(): void {
        this.files = {};
    }
    addFile(file: string, metadata: FileMetaData): void {
        // Approximate the amount of bytes necessary for the headers per entry
        const bytesOfHeaders = metadata.headers.map(s => s.length + 5).reduce((p, c) => p + c, 0);

        this.files[file] = { start: metadata.firstDate, indices: metadata.fileSizeData.indices, bytesOfHeaders };
    }
    estimateSize(from: string, to: string): number {
        // Estimate size from the number of entries and the size of the file
        let size = 0;
        Object.keys(this.files).forEach(f => {
            const file = this.files[f];
            // for each index check difference
            file.indices.forEach(([date, entries, chunkSize], i) => {
                // Per data size index, if it starts before/at the previous index date, and ends before/at the current index date
                const testDateStart = i == 0 ? file.start : file.indices[i-1][0];
                const latestStart = DEFAULT_COMPARATOR(testDateStart, from) >= 0 ? testDateStart : from;
                const earliestEnd = DEFAULT_COMPARATOR(date, to) <= 0 ? date : to;
                if (DEFAULT_COMPARATOR(latestStart, earliestEnd) <= 0) {
                    size += chunkSize + entries * (3 + file.bytesOfHeaders + FILE_NAME_HEADER.length + f.length + RESOLVED_TIMESTAMP_HEADER.length + RESOLVED_TIMESTAMP_FORMAT.length + 3);
                }
            });
        });

        return size;
    }
}
