/** @jsxImportSource @emotion/react */
import React from "react";
import { Tooltip } from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Dayjs } from "dayjs";
import { TRACY_MAX_FILE_SIZE, WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { formatNumber, parseDateNumber, parseDateString } from "../utility";
import { Ext2WebMessage, postW2EMessage, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import DateTimeSlider from "./DateTimeSlider";
import DateTimeRangeSlider from "./DateTimeRangeSlider";
import DateTimeRangeRail from "./DateTimeRangeRail";
import { FileDataContext } from "./FileDataContext";

interface Props {
    startDate: Dayjs;
    endDate: Dayjs;
    amountOfFiles: number;
    onChangeStartDate: (value: Dayjs | null) => void;
    onChangeEndDate: (value: Dayjs | null) => void;
}

let initialization = false;
export default function DateTimeRangeSelection({ startDate, endDate, amountOfFiles, onChangeStartDate, onChangeEndDate }: Props) {
    const [showLoadingDate, setShowLoadingDate] = React.useState(false);

    const [earliestDate, setEarliestDate] = React.useState<Dayjs>(parseDateNumber(0));
    const [latestDate, setLatestDate] = React.useState<Dayjs>(parseDateNumber(0));

    const { fileData, fileDataDispatch: _ } = React.useContext(FileDataContext);
    const sliderRailBars = Object.keys(fileData)
        .map(f => ({
            begin: parseDateString(fileData[f].dates[0]).valueOf(),
            end: parseDateString(fileData[f].dates[1]).valueOf(),
            color: fileData[f].headers.length === 0 ? "red" : undefined,
            label: f,
        }));

    // Output file size
    const [fileSize, setFileSize] = React.useState(0);
    const fileTooBig = fileSize > TRACY_MAX_FILE_SIZE;

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                initialization = false;
                break;
            case "size-estimate":
                setFileSize(message.size ?? 0);
                break;
            case "metadata": {
                setShowLoadingDate(false);

                // Update dates
                const startDateUtc = parseDateString(message.totalStartDate);
                const endDateUtc = parseDateString(message.totalEndDate);
                setEarliestDate(startDateUtc);
                setLatestDate(endDateUtc);
                break;
            }
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            setFileSize(prevState.fileSize);
            setEarliestDate(parseDateString(prevState.edgeDates[0]));
            setLatestDate(parseDateString(prevState.edgeDates[1]));
        }
    }, []);


    React.useEffect(() => {
        if (initialization) return;
        const earliestDateString = earliestDate.isValid() ? earliestDate.toISOString() : "";
        const latestDateString = latestDate.isValid() ? latestDate.toISOString() : "";
        updateWebviewState({ fileSize, edgeDates: [earliestDateString, latestDateString] });
    }, [fileSize, earliestDate, latestDate]);

    // If the selected timestamp range changes
    // React.useEffect(() => {
    //     if (initialization) return;
    //     postW2EMessage({ command: "get-file-size", date_start: startDate.toISOString(), date_end: endDate.toISOString()});
    // }, [startDate.valueOf(), endDate.valueOf()]);

    function changeDates(value: number | number[]) {
        if (typeof value !== "number") {
            const [startDateNum, endDateNum] = value;
            onChangeStartDate(parseDateNumber(startDateNum));
            onChangeEndDate(parseDateNumber(endDateNum));
        }
    }

    function getFileSize() {
        postW2EMessage({ command: "get-file-size", date_start: startDate.toISOString(), date_end: endDate.toISOString()});
    }

    return (<div css={{ width: "50vw" }}>
        <Tooltip title="The output only contains timestamps between these two dates/times." disableInteractive>
            <h3>Timestamp range selection: </h3>
        </Tooltip>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <div css={{ display: 'flex', alignItems: 'flex-start' }}>
                {/* <DateTimePicker label="Start Timestamp" value={startDate} 
                    minDateTime={earliestDate} maxDateTime={latestDate}
                    views={["hours", "minutes", "seconds"]} ampm={false} format={WEBVIEW_TIMESTAMP_FORMAT} 
                    onChange={onChangeStartDate}
                /> */}
                {/* <DateTimeSlider inverted value={startDate} min={earliestDate} max={latestDate} limit={endDate} onChange={onChangeStartDate} onChangeComplete={getFileSize}/>
                <DateTimeSlider value={endDate} min={earliestDate} max={latestDate} limit={startDate} onChange={onChangeEndDate} onChangeComplete={getFileSize}/> */}
                <DateTimeRangeSlider
                    startDate={startDate}
                    endDate={endDate}
                    earliestDate={earliestDate}
                    latestDate={latestDate}
                    onChange={changeDates}
                    onChangeCommitted={getFileSize}
                />
                {/* <DateTimePicker label="End Timestamp" value={endDate} 
                    minDateTime={earliestDate} maxDateTime={latestDate}
                    views={["hours", "minutes", "seconds"]} ampm={false} format={WEBVIEW_TIMESTAMP_FORMAT} 
                    onChange={onChangeEndDate}
                    
                /> */}
                <div>
                    {(showLoadingDate && amountOfFiles > 0) && <VSCodeProgressRing/>}
                </div>
            </div>
            <DateTimeRangeRail begin={earliestDate.valueOf()} end={latestDate.valueOf()} bars={sliderRailBars} start={startDate.valueOf()} stop={endDate.valueOf()}/>
        </LocalizationProvider>
        
        <Tooltip title="The output file size may be much larger than the sum of the input file sizes due to differences in formatting." disableInteractive>
            <div>Estimated file size (serialized output): <span>{formatNumber(fileSize)}</span>B. {fileTooBig && <span css={{color: 'red'}}>TOO BIG!</span>}</div>
        </Tooltip>
    </div>);
}