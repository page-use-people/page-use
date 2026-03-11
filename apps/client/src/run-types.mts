export type TRunStatus = 'running' | 'completed' | 'aborted' | 'error';

export type TRunUpdate =
    | {
          readonly type: 'text';
          readonly message: string;
      }
    | {
          readonly type: 'execution_start';
          readonly executionIdentifier: string;
          readonly description: string;
          readonly code: string;
      }
    | {
          readonly type: 'execution_result';
          readonly executionIdentifier: string;
          readonly description: string;
          readonly result: string;
          readonly error: string | null;
      }
    | {
          readonly type: 'waiting_for_state';
          readonly variables: readonly string[];
      }
    | {
          readonly type: 'state_update_observed';
          readonly variable: string;
      }
    | {
          readonly type: 'state_wait_timeout';
          readonly variables: readonly string[];
      };

export type TRunOptions = {
    readonly onMessage?: (message: string) => void;
    readonly onUpdate?: (update: TRunUpdate) => void;
    readonly onStatusChange?: (status: TRunStatus) => void;
    readonly onError?: (error: unknown) => void;
};

export type TRunHandle = {
    readonly abort: () => void;
    readonly done: Promise<void>;
};
