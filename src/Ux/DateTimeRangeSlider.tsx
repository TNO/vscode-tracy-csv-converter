/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React from "react";
import { DEFAULT_TIME_SELECTION_STEPSIZE, DEFAULT_TIME_SELECTION_STEPSIZE_CTRL, DEFAULT_TIME_SELECTION_STEPSIZE_SHIFT, WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import { Slider, Tooltip } from "@mui/material";
import { FileDataContext } from "./FileDataContext";
import { parseDateNumber, parseDateString } from "../utility";
import { DatesContext, DatesDispatchContext } from "./DatesContext";
import { postW2EMessage } from "../communicationProtocol";

interface Props {

}

export default function DateTimeRangeSlider({}: Props) {

    const dates = React.useContext(DatesContext);
    const datesDispatch = React.useContext(DatesDispatchContext);
    
    const dateBeginDayjs = parseDateNumber(dates.begin);
    const dateEndDayjs = parseDateNumber(dates.end);


    const { fileData, fileDataDispatch: _ } = React.useContext(FileDataContext);

    const startStopMarks = React.useMemo(() => 
        Object.keys(fileData).map(f => fileData[f].dates)
            .reduce((p: {value: number}[], d: [string, string]) => 
                p.concat([
                    { value: parseDateString(d[0]).valueOf() },
                    { value: parseDateString(d[1]).valueOf() }
                ]), [])
    , [fileData]);

    const [stepSize, setStepSize] = React.useState(DEFAULT_TIME_SELECTION_STEPSIZE);
    const shifted = React.useRef(false);
    const control = React.useRef(false);
    function updateStepSize() {
        setStepSize(DEFAULT_TIME_SELECTION_STEPSIZE
            / ((control.current ? DEFAULT_TIME_SELECTION_STEPSIZE_CTRL : 1)
                * (shifted.current ? DEFAULT_TIME_SELECTION_STEPSIZE_SHIFT : 1)));
    }
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            shifted.current = true;
            updateStepSize();
        }
        if (event.key === "Control") {
            control.current = true;
            updateStepSize();
        }
    };
    const onKeyup = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            shifted.current = false;
            updateStepSize();
        }
        if (event.key === "Control") {
            control.current = false;
            updateStepSize();
        }
    }

    // Run only once!
    React.useEffect(() => {
        window.addEventListener("keydown", onKeydown);
        window.addEventListener("keyup", onKeyup);
    }, []);

    function updateDates(value: number | number[], t: number) {
        if (typeof value !== "number") {
            datesDispatch({ type: "update-selection", begin: value[0], end: value[1] })
        }
    }

    function getFileSize() {
        postW2EMessage({
            command: "get-file-size",
            date_start: dateBeginDayjs.toISOString(),
            date_end: dateEndDayjs.toISOString()
        });
    }

    const helpListItemStyle = css({ fontSize: "12px", padding: "2px", listStyleType: "circle"});
    return <div css={{width: "100%"}}>
        <Tooltip title={<div><h2 css={{ fontSize: "16px", fontWeight: "bold", marginBottom: "2px" }}>Help</h2>
            <span css={{ fontSize: "14px" }}>Use the arrow keys to fine-tune your selection.</span>
            <ul css={{ marginTop: "2px" }}>
                <li css={helpListItemStyle}>Default step size: <b>1 minute</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Shift</b> for a step size of <b>1 second</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Ctrl</b> for a step size of <b>60 ms</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Shift</b> and <b>Ctrl</b> for a stepsize of <b>1 ms</b>.</li>
            </ul></div>}>
            <i className="codicon codicon-question" />
        </Tooltip>
        <div css={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <span>{dateBeginDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
            <span>{dateEndDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        </div>
        <Slider
            value={[dates.begin, dates.end]}
            min={dates.earliest}
            max={dates.latest}
            step={stepSize}
            onChange={(_, v, t) => updateDates(v, t)}
            onChangeCommitted={getFileSize}
            marks={startStopMarks}
            disableSwap
            sx={{
                '& .MuiSlider-thumb': {
                    borderRadius: '1px',
                    width: "5px"
                },
            }}
        />
    </div>
}