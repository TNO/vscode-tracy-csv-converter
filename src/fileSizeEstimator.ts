import dayjs from "dayjs";
import fs from "fs";
import { DEFAULT_COMPARATOR } from './converters';

type FileSize = {
    size: number,
    fromTimestamp: string,
    toTimestamp: string,
    bpms: number, // Bytes per ms (between the two timestamps)
}
export class FileSizeEstimator {
    private files: {[s: string]: FileSize};

    constructor() {
        this.files = {};
    }

    public clear() {
        this.files = {};
    }

    public addFile(file: string, start: string, end: string) {
        const size = fs.statSync(file).size;
        console.log(`File ${file} has size ${size}`);
        const msdiff = dayjs(start).diff(dayjs(end));
        this.files[file] = { size, fromTimestamp: start, toTimestamp: end, bpms: size/msdiff };
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