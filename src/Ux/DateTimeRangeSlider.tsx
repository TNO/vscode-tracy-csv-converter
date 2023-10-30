import dayjs from "dayjs";
import React from "react";
import { WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import { Slider } from "@mui/material";
import { FileDataContext } from "./FileDataContext";
import { parseDateString } from "../utility";

interface Props {
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    earliestDate: dayjs.Dayjs;
    latestDate: dayjs.Dayjs;
    onChange: (v: number | number[], t: number) => void;
    onChangeCommitted: () => void;
}

export default function DateTimeRangeSlider({startDate, endDate, earliestDate, latestDate, onChange, onChangeCommitted}: Props) {

    const { fileData, fileDataDispatch } = React.useContext(FileDataContext);

    const startStopMarks = React.useMemo(() => 
        Object.keys(fileData).map(f => fileData[f].dates)
            .reduce((p: {value: number, label: string}[], d: [string, string]) => 
                p.concat([
                    { value: parseDateString(d[0]).valueOf(), label: "b" },
                    { value: parseDateString(d[1]).valueOf(), label: "e" }
                ]), [])
    , [fileData]);

    const [stepSize, setStepSize] = React.useState(60_000);
    const shifted = React.useRef(false);
    const control = React.useRef(false);
    function updateStepSize() {
        setStepSize(60_000 / ((control.current ? 1000 : 1) * (shifted.current ? 60 : 1)));
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

    return <div style={{width: "100%"}}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <span>{startDate.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
            <span>{endDate.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        </div>
        <Slider
            value={[startDate.valueOf(), endDate.valueOf()]}
            min={earliestDate.valueOf()}
            max={latestDate.valueOf()}
            step={stepSize}
            onChange={(_, v, t) => onChange(v, t)}
            onChangeCommitted={onChangeCommitted}
            marks={startStopMarks}
        />
    </div>
}