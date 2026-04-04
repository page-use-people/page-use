import {createContext, useContext} from 'react';

export const AgentTargetContext = createContext<string | null>(null);

export const useAgentTarget = (): string | null =>
    useContext(AgentTargetContext);
