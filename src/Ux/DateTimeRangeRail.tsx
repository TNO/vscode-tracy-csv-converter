/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Property } from "csstype";

interface Bar {
    begin: number;
    end: number;
    color?: Property.BackgroundColor;
}

interface Props {
    begin: number;
    end: number;
    bars: Bar[];
}
const verticalPadding = "10px";

export default function DateTimeRangeRail(props: Props) {

    function getBar(bar: Bar) {
        const percentageWidth = (bar.end - bar.begin) * 100 / (props.end - props.begin);
        const percentageHeight = "10px";//`calc((100%-${verticalPadding}*2)/${props.bars.length})%`;
        const percentageLeft = (bar.begin) * 100 / (props.end - props.begin);
        const style = css({
            backgroundColor: bar.color ?? "lightgrey",
            width: `${percentageWidth}%`,
            height: percentageHeight,
            marginLeft: `${percentageLeft}%`,
            borderRadius: "2.5px",
        });
        return (
            <div css={style}></div>
        );
    }

    return (
        <div className="simple-border" css={{ width: "100%", paddingTop: verticalPadding, paddingBottom: verticalPadding }}>
            {props.bars.map((bar, index) => getBar(bar))}
        </div>
    );
}