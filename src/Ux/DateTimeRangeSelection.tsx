/** @jsxImportSource @emotion/react */
import React from "react";
import { Tooltip } from "@mui/material";
import { TRACY_MAX_FILE_SIZE } from "../constants";
import { formatNumber, parseDateString } from "../utility";
import { Ext2WebMessage, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import DateTimeRangeSlider from "./DateTimeRangeSlider";
import FileTimeline from "./FileTimeline";
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

    return (<div css={{ width: "75vw", overflow: "visible" }}>
        <Tooltip title="The output only contains timestamps between these two dates/times." disableInteractive>
            <h3>Timestamp range selection: </h3>
        </Tooltip>
        <div css={{ width: "80%" }}>
            <DateTimeRangeSlider/>
        </div>
        <div css={{ display: 'flex', alignItems: 'flex-start' }}>
            <div css={{ width: "80%" }}>
                <FileTimeline earliest={dates.earliest} latest={dates.latest} bars={sliderRailBars} begin={dates.begin} end={dates.end}/>
            </div>
            <div className="timeline-vertical-padding" css={{ marginLeft: "5px" }}>
                {sliderRailBars.map((v, i) => (
                    <div key={i} className="timeline-bar-text">
                        <Tooltip title={v.label} disableInteractive>
                            <span>{v.label.slice(v.label.lastIndexOf("/")+1)}</span>
                        </Tooltip>
                    </div>))}
            </div>
        </div>
        
        <Tooltip title="The output file size may be much larger than the sum of the input file sizes due to differences in formatting." disableInteractive>
            <div>Estimated file size (serialized output): <span>{formatNumber(fileSize)}</span>B. {fileTooBig && <span css={{color: 'red'}}>TOO BIG!</span>}</div>
        </Tooltip>
    </div>);
}