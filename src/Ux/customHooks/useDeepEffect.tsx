import React from "react";
import { isEqual } from "lodash";

/**
 * Executes the given callback should the dependencies change. The change is measured using a deep equals.
 * A shorter version of the hook in https://github.com/kentcdodds/use-deep-compare-effect/blob/main/src/index.ts
 * @param callback The effect callback.
 * @param dependencies The effect's dependencies.
 * @returns Hopefully nothing.
 */
export default function useDeepEffect(callback: React.EffectCallback, dependencies: React.DependencyList): ReturnType<typeof React.useEffect> {
    const ref = React.useRef(dependencies);
    const signalRef = React.useRef<number>(0);

    if (!isEqual(ref.current, dependencies)) {
        ref.current = dependencies;
        signalRef.current++;
    }

    return React.useEffect(callback, React.useMemo(() => ref.current, [signalRef.current]));
}
