/** @jsxImportSource @emotion/react */
import { Slider } from "@mui/material";
import React from "react";
import { parseDateNumber } from "../utility";
import { WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import dayjs from "dayjs";

function getUnitMax(unit: dayjs.UnitType) {
    switch(unit) {
        case "millisecond":
        case "milliseconds":
        case "ms":
            return 1000;
        case "second":
        case "seconds":
        case "s":
            return 60;
        case "minute":
        case "minutes":
        case "m":
            return 60;
        case "hour":
        case "hours":
        case "h":
            return 24;
        case "day":
        case "days":
        case "d":
            return 6;
        case "month":
        case "months":
        case "M":
            return 12;
        case "year":
        case "years":
        case "y":
            return 2200; // TEMP
        case "date":
        case "dates":
        case "D":
            return 31;
    }
}

interface Props {
    value?: dayjs.Dayjs;
    min?: dayjs.Dayjs;
    max?: dayjs.Dayjs;
    limit?: dayjs.Dayjs;
    onChange?: (d: dayjs.Dayjs) => void;
    onChangeComplete?: (d: dayjs.Dayjs) => void;
    inverted?: boolean;
}

// This component tries to allow the user to select a date/time using a multitude of sliders. With each slider handling a different part of the date/time.
export default function DateTimeSlider({ value, min, max, limit, onChange, onChangeComplete, inverted = false }: Props) {
    const isControlled = typeof value !== 'undefined';
    const hasMin = typeof min !== 'undefined';
    const hasMax = typeof max !== 'undefined';
    const usedLimit = typeof limit!== 'undefined'? limit : max;

    const [date, setDate] = React.useState<dayjs.Dayjs>(parseDateNumber(0));

    const usedDate = isControlled ? value : date;

    const onDateChange = (value: number | number[], unit: dayjs.UnitType) => {
        let numValue = 0;
        if (typeof value === "number") {
            numValue = value;
        } else {
            numValue = value[0]
        }
        // Only change the specified unit of the date
        const newDate = usedDate.set(unit, numValue);
        if (onChange) {
            onChange(newDate);
        }
        if (!isControlled) {
            setDate(date.set(unit, numValue));
        }
        console.log("first?");
    }

    const onDateChangeComplete = (value: number | number[], unit: dayjs.UnitType) => {
        let numValue = 0;
        if (typeof value === "number") {
            numValue = value;
        } else {
            numValue = value[0]
        }
        // Only change the specified unit of the date
        const newDate = usedDate.set(unit, numValue);
        if (onChangeComplete) {
            onChangeComplete(newDate);
        }
        console.log("second?");
    }

    function makeSlider(unit: dayjs.UnitType) {
        const usedMin = 0;//hasMin? min.get(unit) : 0;
        const usedMax = getUnitMax(unit)-1;//hasMax? max.get(unit) : getUnitMax(unit)-1;
        return <Slider 
            track={inverted ? "inverted" : "normal"}
            value={usedDate.get(unit)}
            min={usedMin}
            max={usedMax}
            step={1}
            onChange={(_e, v) => onDateChange(v, unit)}
            onChangeCommitted={(_e, v) => {onDateChangeComplete(v, unit)}}
        />
    }

    return <div className="simple-border" css={{ padding: "15px" }}>
        <span>{usedDate.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        {makeSlider("year")}
        {makeSlider("month")}
        {makeSlider("date")}
        {makeSlider("hour")}
        {makeSlider("minute")}
        {makeSlider("second")}
    </div>;
}