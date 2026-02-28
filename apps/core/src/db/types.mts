import type {Generated, Insertable, Selectable, Updateable} from 'kysely';
import type {TInferenceAPI} from '#core/db/overrides.mjs';

type TInferenceCallTable = {
    readonly id: string;
    readonly api: TInferenceAPI;
    readonly model: string;
    readonly meta: unknown | null;
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly thinking_tokens: number;
    readonly request: string;
    readonly response: string;
    readonly endpoint: string;
    readonly method: string;
    readonly created_at: Generated<Date>;
};

type TDatabase = {
    readonly inference_calls: TInferenceCallTable;
};

type TSelectableInferenceCall = Selectable<TInferenceCallTable>;
type TInsertableInferenceCall = Insertable<TInferenceCallTable>;
type TUpdateableInferenceCall = Updateable<TInferenceCallTable>;

export type {
    TDatabase,
    TInferenceCallTable,
    TSelectableInferenceCall,
    TInsertableInferenceCall,
    TUpdateableInferenceCall,
};
