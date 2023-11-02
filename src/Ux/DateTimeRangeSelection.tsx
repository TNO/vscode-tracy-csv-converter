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
import { FileDataContext } from "./context/FileDataContext";
import { DatesContext } from "./context/DatesContext";

interface Props {
    amountOfFiles: number;
}

let initialization = false;
export default function DateTimeRangeSelection({ amountOfFiles }: Props) {
    const [showLoadingDate, setShowLoadingDate] = React.useState(false);

    const dates = React.useContext(DatesContext);

    // Get the bars for the date time rail
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
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ fileSize });
    }, [fileSize]);

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
                {/* <DateTimePicker label="End Timestamp" value={endDate} 
                    minDateTime={earliestDate} maxDateTime={latestDate}
                    views={["hours", "minutes", "seconds"]} ampm={false} format={WEBVIEW_TIMESTAMP_FORMAT} 
                    onChange={onChangeEndDate}
                    
                /> */}
                {/* <DateTimeSlider inverted value={startDate} min={earliestDate} max={latestDate} limit={endDate} onChange={onChangeStartDate} onChangeComplete={getFileSize}/>
                <DateTimeSlider value={endDate} min={earliestDate} max={latestDate} limit={startDate} onChange={onChangeEndDate} onChangeComplete={getFileSize}/> */}
                <DateTimeRangeSlider/>
                <div>
                    {(showLoadingDate && amountOfFiles > 0) && <VSCodeProgressRing/>}
                </div>
            </div>
            <DateTimeRangeRail begin={dates.earliest} end={dates.latest} bars={sliderRailBars} start={dates.begin} stop={dates.end}/>
        </LocalizationProvider>
        
        <Tooltip title="The output file size may be much larger than the sum of the input file sizes due to differences in formatting." disableInteractive>
            <div>Estimated file size (serialized output): <span>{formatNumber(fileSize)}</span>B. {fileTooBig && <span css={{color: 'red'}}>TOO BIG!</span>}</div>
        </Tooltip>
    </div>);
}