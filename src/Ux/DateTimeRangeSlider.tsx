/** @jsxImportSource @emotion/react */
import React from "react";
import { DEFAULT_TIME_SELECTION_STEPSIZE, DEFAULT_TIME_SELECTION_STEPSIZE_SMALLER, DEFAULT_TIME_SELECTION_STEPSIZE_SMALL, WEBVIEW_TIMESTAMP_FORMAT, DEFAULT_TIME_SELECTION_SMALL, DEFAULT_TIME_SELECTION_SMALLER } from "../constants";
import { Slider } from "@mui/material";
import { parseDateNumber } from "../utility";
import { DatesContext, DatesDispatchContext } from "./context/DatesContext";
import { postW2EMessage } from "../communicationProtocol";

interface Props {
    min?: number;
    max?: number;
}

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
export default function DateTimeRangeSlider({ min, max }: Props) {

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
            / ((control.current ? DEFAULT_TIME_SELECTION_STEPSIZE_SMALLER : 1)
                * (shifted.current ? DEFAULT_TIME_SELECTION_STEPSIZE_SMALL : 1)));
    }
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === DEFAULT_TIME_SELECTION_SMALL) {
            shifted.current = true;
            updateStepSize();
        }
        if (event.key === DEFAULT_TIME_SELECTION_SMALLER) {
            control.current = true;
            updateStepSize();
        }
    };
    const onKeyup = (event: KeyboardEvent) => {
        if (event.key === DEFAULT_TIME_SELECTION_SMALL) {
            shifted.current = false;
            updateStepSize();
        }
        if (event.key === DEFAULT_TIME_SELECTION_SMALLER) {
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

    function updateDates(value: number | number[]) {
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

    return <div css={{width: "100%"}}>
        {/* Selected Dates Display */}
        <div css={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <span>{dateBeginDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
            <span>{dateEndDayjs.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        </div>
        {/* Selected Dates Slider */}
        <Slider
            value={[dates.begin, dates.end]}
            min={min ?? dates.earliest}
            max={max ?? dates.latest}
            step={stepSize}
            onChange={(_, v) => updateDates(v)}
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