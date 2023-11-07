import { isEqual } from "lodash";
import React from "react";
import { FileData } from "../../communicationProtocol";

export default function useEffectFileData(callback: React.EffectCallback, dependency: {[s: string]: FileData}, equalKeys: readonly (keyof FileData)[]) {
    const ref = React.useRef(dependency);
    const signalRef = React.useRef<number>(0);

    const fileNamesDep = Object.keys(dependency);
    const fileNamesRef = Object.keys(ref.current);

    const equal = ref.current
        && fileNamesDep.length === fileNamesRef.length // Equal length
        && fileNamesDep.every((f: string) => fileNamesRef.includes(f)) // Equal files
        && fileNamesDep.every((f: string) => 
            equalKeys.every((k: keyof FileData) => isEqual(ref.current[f][k], dependency[f][k]))); // Deep equal
    if (!equal) {
        ref.current = dependency;
        signalRef.current++;
    }

    return React.useEffect(callback, [signalRef.current]);
}