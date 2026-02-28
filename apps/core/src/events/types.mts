import type {Emitter} from 'mitt';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type TEventMap = {};

type TEmitter = Emitter<TEventMap>;

export type {TEventMap, TEmitter};
