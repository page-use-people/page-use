import {useEffect, useMemo, useState} from 'react';
import {observer} from '../lib/observe.js';

import {useChatWidget} from '../stores/chat-context.js';
import {tw} from '../lib/twind.js';

const SPINNER_FRAMES = ['·', '✻', '✽', '✶', '✢'] as const;

const LOADING_PHRASES = Object.freeze([
    'doing agentic things',
    'agenting agentically',
    'agent go brrrr',
    'thinking like an agent',
    'thinking agentically',
    'putting agent hat on',
    'pondering agentically',
    'agentic pondering',
    'agent pondering',
    'doing agentic stuff',
    'agent beep booping',
    'agent-as-a-service-ing',
    'doing agent stuff',
    'doing agent things',
] as const);

const useSpinner = (isRunning: boolean): string => {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (!isRunning) {
            return;
        }

        const intervalId = setInterval(
            () =>
                setFrame(
                    (previousFrame) =>
                        (previousFrame + 1) % SPINNER_FRAMES.length,
                ),
            250,
        );
        return () => clearInterval(intervalId);
    }, [isRunning]);

    return SPINNER_FRAMES[frame] ?? '·';
};

export const ExecutionStatus = observer(() => {
    const {session, config} = useChatWidget();
    const spinnerCharacter = useSpinner(session.isRunning);

    const loadingPhrase = useMemo(
        () =>
            LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)],
        [session.isRunning],
    );

    const latestStep =
        session.activeExecutionSteps.length > 0
            ? session.activeExecutionSteps[
                  session.activeExecutionSteps.length - 1
              ]
            : loadingPhrase;

    return session.isRunning ? (
        <div
            className={tw(
                'border-y border-[color:var(--pu-muted)] py-2 text-[color:var(--pu-fg)] italic text-xs flex flex-col gap-2',
            )}>
            <div className={tw('flex flex-row gap-2')}>
                <div
                    className={tw(
                        'text-[color:var(--pu-accent)] w-5 text-center',
                    )}>
                    {spinnerCharacter}
                </div>{' '}
                {latestStep}{' '}
            </div>
            {config.devMode && session.activeExecutionSteps.length > 0 ? (
                <div
                    className={tw(
                        'flex flex-col gap-1 not-italic whitespace-pre-wrap',
                    )}>
                    {session.activeExecutionSteps.map((step, stepIndex) => (
                        <div key={`${stepIndex}-${step}`}>{step}</div>
                    ))}
                </div>
            ) : null}
        </div>
    ) : null;
});
