/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React from "react";
import { DEFAULT_TIME_SELECTION_STEPSIZE, DEFAULT_TIME_SELECTION_STEPSIZE_CTRL, DEFAULT_TIME_SELECTION_STEPSIZE_SHIFT, WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import { Slider, Tooltip } from "@mui/material";
import { FileDataContext } from "./FileDataContext";
import { parseDateNumber, parseDateString } from "../utility";
import { DatesContext, DatesDispatchContext } from "./DatesContext";
import { postW2EMessage } from "../communicationProtocol";


/**
 * Renders a date/time range slider component for selecting the start and end timestamps 
 * to filter the CSV data by.
 * 
 * Uses the DatesContext to get the earliest and latest timestamps across all CSV files,
 * as well as the currently selected start/end timestamps. Dispatches actions to the 
 * DatesContext to update the selection when the slider changes.
 * 
 * Allows fine-grained control over the slider step size using Shift and Ctrl modifiers.
 * 
 * Triggers a file size estimate recalculation whenever the selection changes.
 */
export default function DateTimeRangeSlider() {

    // Import the dates data
    const dates = React.useContext(DatesContext);
    const datesDispatch = React.useContext(DatesDispatchContext);
    
    const dateBeginDayjs = parseDateNumber(dates.begin);
    const dateEndDayjs = parseDateNumber(dates.end);

    // Step size logic
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
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener("keydown", onKeydown);
        window.addEventListener("keyup", onKeyup);

        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("keyup", onKeyup);
        }
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
        {/* Helper Tooltip */}
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
        {/* Selected Dates Display */}
        <div css={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <span>{dateBeginDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
            <span>{dateEndDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        </div>
        {/* Selected Dates Slider */}
        <Slider
            value={[dates.begin, dates.end]}
            min={dates.earliest}
            max={dates.latest}
            step={stepSize}
            onChange={(_, v, t) => updateDates(v, t)}
            onChangeCommitted={getFileSize}
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