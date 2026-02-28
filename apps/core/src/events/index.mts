import {default as mittExport} from 'mitt';
import type {TEventMap, TEmitter} from '#core/events/types.mjs';

const mitt = mittExport as unknown as typeof mittExport.default;
const createEmitter = (): TEmitter => mitt<TEventMap>();

export {createEmitter};
export type {TEventMap, TEmitter} from '#core/events/types.mjs';
