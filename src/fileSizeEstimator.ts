import dayjs from "dayjs";
import fs from "fs";
import { DEFAULT_COMPARATOR } from './converters';
import { FileMetaData } from "./communicationProtocol";
import { FILE_NAME_HEADER } from "./constants";

type SimpleFileSize = {
    size: number,
    fromTimestamp: string,
    toTimestamp: string,
    bpms: number, // Bytes per ms (between the two timestamps)
}

export interface FileSizeEstimator {
    clear(): void;
    addFile(file: string, metadata: FileMetaData): void;
    estimateSize(from: string, to: string): number;
}
export class SimpleFileSizeEstimator implements FileSizeEstimator {
    private files: {[s: string]: SimpleFileSize};

    constructor() {
        this.files = {};
    }

    public clear() {
        this.files = {};
    }

    public addFile(file: string, metadata: FileMetaData) {
        const size = fs.statSync(file).size;
        console.log(`File ${file} has size ${size}`);
        const msdiff = dayjs(metadata.firstDate).diff(dayjs(metadata.lastDate));
        this.files[file] = { size, fromTimestamp: metadata.firstDate, toTimestamp: metadata.lastDate, bpms: size/msdiff };
    }

    public estimateSize(from: string, to: string): number {
        // Estimate size per file
        let size = 0;
        Object.keys(this.files).forEach(f => {
            const file = this.files[f]; // a
            // Check if in file
            const latestStart = DEFAULT_COMPARATOR(file.fromTimestamp, from) >= 0 ? file.fromTimestamp : from;
            const earliestEnd = DEFAULT_COMPARATOR(file.toTimestamp, to) <= 0 ? file.toTimestamp : to;
            if (DEFAULT_COMPARATOR(latestStart, earliestEnd) <= 0) {
                // It is in the file, get the intersection
                console.log("Size between", latestStart, "and", earliestEnd, `bpms: ${file.bpms}`);
                size += (Number.isNaN(file.bpms) ? 0 : file.bpms) * dayjs(latestStart).diff(dayjs(earliestEnd));
            }

        });
        return size;
    }
}

type MediumFileSizeData = {
    start: string;
    indices: [string, number][];
    size: number;
    avgBytePerFileEntry: number;
    bytesOfHeaders: number;
}

export class MediumFileSizeEstimator implements FileSizeEstimator {
    // Keep the amount of indices per time range and the 
    
    private files: { [s: string]: MediumFileSizeData };
    constructor() {
        this.files = {};
    }
    clear(): void {
        this.files = {};
    }
    addFile(file: string, metadata: FileMetaData): void {
        const size = fs.statSync(file).size;
        const avgBytePerEntry = size / metadata.dataSizeIndices.map(di => di[1]).reduce((p, c) => p + c);
        const bytesOfHeaders = metadata.headers.map(s => s.length + 5).reduce((p, c) => p + c);
        this.files[file] = { start: metadata.firstDate, indices: metadata.dataSizeIndices, size, avgBytePerFileEntry: avgBytePerEntry, bytesOfHeaders };
    }
    estimateSize(from: string, to: string): number {
        // Estimate size from the number of entries and the size of the file
        let size = 0;
        Object.keys(this.files).forEach(f => {
            let amountOfEntriesOfFile = 0;
            const file = this.files[f];
            // for each index check difference
            file.indices.forEach(([date, entries], i) => {
                // Per data size index, if it starts before/at the previous index date, and ends before/at the current index date
                const startsBeforeStartPrevious = i == 0 ? DEFAULT_COMPARATOR(file.start, to) <= 0 : DEFAULT_COMPARATOR(from, file.indices[i-1][0]) <= 0;
                const endsAfterEndCurrent = DEFAULT_COMPARATOR(date, to) <= 0;
                if (startsBeforeStartPrevious && endsAfterEndCurrent) {
                    amountOfEntriesOfFile += entries; // add amount of entries
                }
            });

            // Add approximate of file: ({ <entry> }, => 3 so add the bytes for that) (<entry> === <header>: <value> original file only has headers at the start, now with every entry)
            size += amountOfEntriesOfFile * (3 + file.avgBytePerFileEntry + file.bytesOfHeaders + FILE_NAME_HEADER.length + f.length + 3);
        });

        return size;
    }
}
