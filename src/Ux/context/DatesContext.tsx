import React from "react";
import { DatesState, postW2EMessage } from "../../communicationProtocol";
import { parseDateNumber } from "../../utility";

type DatesReducerAction = { type: "update-earliest", date: number }
    | { type: "update-limits", earliest: number, latest: number }
    | { type: "update-selection", begin: number, end: number }
    | { type: "new-state", state: DatesState };

export function DatesReducer(state: DatesState, action: DatesReducerAction): DatesState {
    switch (action.type) {
        case "new-state":
            return action.state;
        case "update-earliest":
            return { ...state, earliest: action.date };
        case "update-limits": {
            const newState = { ...state, earliest: action.earliest, latest: action.latest };
            // Only update the user selected dates if there is no other choice.
            if (state.begin === state.earliest || state.begin < action.earliest) {
                newState.begin = action.earliest;
            }
            if (state.end === state.latest || state.end > action.latest) {
                newState.end = action.latest;
            }
            postW2EMessage({
                command: "get-file-size",
                date_start: parseDateNumber(newState.begin).toISOString(),
                date_end: parseDateNumber(newState.end).toISOString()
            });
            return newState;
        }
        case "update-selection": {
            // if (state.begin !== action.begin || state.end !== action.end)
            // postW2EMessage({
            //     command: "get-file-size",
            //     date_start: parseDateNumber(action.begin).toISOString(),
            //     date_end: parseDateNumber(action.end).toISOString()
            // });
            return { ...state, begin: action.begin, end: action.end };
        }
    }
    throw "Unknown Dates Action";
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const DatesContext = React.createContext<DatesState>({
    earliest: 0,
    latest: 0,
    begin: 0,
    end: 0
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const DatesDispatchContext = React.createContext<React.Dispatch<DatesReducerAction>>(() => {})

interface ProviderProps extends React.PropsWithChildren {
    dates: DatesState;
    datesDispatch: React.Dispatch<DatesReducerAction>;
}
export function DatesContextProvider({ dates, datesDispatch, children }: ProviderProps) {
    return (<DatesContext.Provider value={dates}><DatesDispatchContext.Provider value={datesDispatch}>{children}</DatesDispatchContext.Provider></DatesContext.Provider>);
}