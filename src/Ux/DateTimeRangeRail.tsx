/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Property } from "csstype";

interface Bar {
    begin: number;
    end: number;
    color?: Property.BackgroundColor;
    label?: string;
}

interface Props {
    begin: number;
    end: number;
    bars: Bar[];
}
const verticalPadding = "10px";
const barCssStyle = css({
    borderRadius: "2.5px",
    fontSize: "10px",
    textAlign: "center"
});

export default function DateTimeRangeRail(props: Props) {

    function getBar(bar: Bar) {
        const percentageWidth = (bar.end - bar.begin) * 100 / (props.end - props.begin);
        const barHeight = "15px";//`calc((100%-${verticalPadding}*2)/${props.bars.length})%`;
        const percentageLeft = (bar.begin - props.begin) * 100 / (props.end - props.begin);
        
        return (
            <div className="simple-border" css={barCssStyle} style={{
                backgroundColor: bar.color ?? "var(--vscode-editor-background)",
                width: `${percentageWidth}%`,
                height: barHeight,
                marginLeft: `${percentageLeft}%`
            }}>{bar.label}</div>
        );
    }

    return (
        <div className="simple-border" css={{ width: "100%", paddingTop: verticalPadding, paddingBottom: verticalPadding }}>
            {props.bars.map((bar) => getBar(bar))}
        </div>
    );
}