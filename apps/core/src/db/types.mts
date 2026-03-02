import type {Generated, Insertable, Selectable, Updateable} from 'kysely';
import type {
    TBlockType,
    TConversationActor,
    TConversationModel,
    TInferenceAPI,
} from '#core/db/overrides.mjs';

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

type TConversationTable = {
    readonly id: string;
    readonly last_turn_by: TConversationActor;
    readonly last_message_at: Date;
    readonly model: TConversationModel;
    readonly created_at: Generated<Date>;
};

type TTurnTable = {
    readonly id: string;
    readonly conversation_id: string;
    readonly actor: TConversationActor;
    readonly created_at: Generated<Date>;
};

type TBlockTable = {
    readonly id: string;
    readonly conversation_id: string;
    readonly turn_id: string;
    readonly type: TBlockType;
    readonly payload: unknown;
    readonly created_at: Generated<Date>;
};

type TDatabase = {
    readonly inference_calls: TInferenceCallTable;
    readonly conversations: TConversationTable;
    readonly turns: TTurnTable;
    readonly blocks: TBlockTable;
};

type TSelectableInferenceCall = Selectable<TInferenceCallTable>;
type TInsertableInferenceCall = Insertable<TInferenceCallTable>;
type TUpdateableInferenceCall = Updateable<TInferenceCallTable>;

type TSelectableConversation = Selectable<TConversationTable>;
type TInsertableConversation = Insertable<TConversationTable>;
type TUpdateableConversation = Updateable<TConversationTable>;

type TSelectableTurn = Selectable<TTurnTable>;
type TInsertableTurn = Insertable<TTurnTable>;
type TUpdateableTurn = Updateable<TTurnTable>;

type TSelectableBlock = Selectable<TBlockTable>;
type TInsertableBlock = Insertable<TBlockTable>;
type TUpdateableBlock = Updateable<TBlockTable>;

export type {
    TDatabase,
    TInferenceCallTable,
    TSelectableInferenceCall,
    TInsertableInferenceCall,
    TUpdateableInferenceCall,
    TConversationTable,
    TSelectableConversation,
    TInsertableConversation,
    TUpdateableConversation,
    TTurnTable,
    TSelectableTurn,
    TInsertableTurn,
    TUpdateableTurn,
    TBlockTable,
    TSelectableBlock,
    TInsertableBlock,
    TUpdateableBlock,
};
