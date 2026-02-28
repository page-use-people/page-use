type TGreeting = {
    readonly message: string;
    readonly timestamp: string;
};

export const greet = (name: string): TGreeting => ({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
});

export type {TGreeting};
