import dayjs from "dayjs";
import fs from "fs";
import { DEFAULT_COMPARATOR } from './converters';

type FileSize = {
    size: number,
    from: string,
    to: string,
    bpms: number,
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
        this.files[file] = { size, from: start, to: end, bpms: size/dayjs(start).diff(dayjs(end)) };
    }

    public estimateSize(from: string, to: string): number {
        // Estimate size per file
        let size = 0;
        Object.keys(this.files).forEach(f => {
            const file = this.files[f]; // a
            // Check if in file (file starts before input starts and ends after input starts) or (range starts before file starts and ends after file starts)
            if (DEFAULT_COMPARATOR(file.from, from) <= 0 && DEFAULT_COMPARATOR(file.to, from) >= 0 ||
                DEFAULT_COMPARATOR(file.from, from) >= 0 && DEFAULT_COMPARATOR(to, file.to) <= 0) {
                // It is in the file, get the intersection
                const latestStart = DEFAULT_COMPARATOR(file.from, from) >= 0 ? file.from : from;
                const earliestEnd = DEFAULT_COMPARATOR(file.to, to) <= 0 ? file.to : to;
                
                size += file.bpms * dayjs(latestStart).diff(dayjs(earliestEnd));
            }

        });
        return size;
    }
}