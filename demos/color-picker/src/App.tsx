import { useState } from 'react';
import { PageUseChat, PageUseFunction, PageUseSystemPrompt, PageUseVariable } from '@page-use/react';
import z from 'zod';
const randomHex = () =>
    `#${Array.from({ length: 6 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;

const luminance = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const systemPrompt = `
    You are a color picker assistant named Picaso.

    For Context:
    - You help me, the user with picking colors.
    - The page is basically
        - Color picker in the middle
        - Choosing a color changes the color of the entire background of the page
        - There are "preset" buttons for "black", and "white"
        - There is a button for "Random Color" it will generate a random color
`;

const colorType = z.string().describe('the currently selected color in hex format');
const textColorType = z
    .string()
    .describe('the current text color, typically black when the luminance is greater than 0.5');
const setColorInput = z.string().describe('the color to set in hex format');
const setColorOutput = z.void().describe('void');

const suggestions = [
    {
        label: 'Pick a warm color',
        prompt: 'Set the page to a warm orange color that still keeps the text readable.',
    },
    {
        label: 'High contrast mode',
        prompt: 'Switch the page to the highest-contrast readable color scheme you can.',
    },
];

const App = () => {
    const [color, setColor] = useState('#ffffff');
    const textColor = luminance(color) > 0.5 ? '#000000' : '#ffffff';

    return (
        <>
            <PageUseSystemPrompt prompt={systemPrompt} />
            <PageUseVariable name="color" value={color} type={colorType} />
            <PageUseVariable name="text_color" value={textColor} type={textColorType} />
            <PageUseFunction
                name="set_color"
                input={setColorInput}
                output={setColorOutput}
                func={async (input) => {
                    setColor(input);
                }}
            />

            <div
                className="min-h-screen flex items-center justify-center"
                style={{ backgroundColor: color, color: textColor }}>
                <div className="flex flex-col items-center gap-6">
                    <p className="text-6xl font-bold tracking-tight font-mono">{color}</p>

                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-24 h-24 cursor-pointer rounded-lg border-2 border-current/20"
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={() => setColor(randomHex())}
                            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 border-current/20 hover:border-current/40 cursor-pointer"
                            style={{ color: textColor }}>
                            Random
                        </button>
                        <button
                            onClick={() => setColor('#ffffff')}
                            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 border-current/20 hover:border-current/40 cursor-pointer"
                            style={{ color: textColor }}>
                            White
                        </button>
                        <button
                            onClick={() => setColor('#000000')}
                            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 border-current/20 hover:border-current/40 cursor-pointer"
                            style={{ color: textColor }}>
                            Black
                        </button>
                    </div>
                </div>
            </div>

            <PageUseChat
                title="PICASO"
                placeholder="Set a color, ask for contrast, or describe a mood"
                greeting="Hello, I'm Picaso. I can see the current page color, keep contrast readable, and call the color setter for you."
                suggestions={suggestions}
                theme={textColor === '#000000' ? 'light' : 'dark'}
            />
        </>
    );
};

export default App;
