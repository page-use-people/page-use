import {useState} from 'react';

const randomHex = () =>
    `#${Array.from({length: 6}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;

const luminance = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const App = () => {
    const [color, setColor] = useState('#ffffff');
    const textColor = luminance(color) > 0.5 ? '#000000' : '#ffffff';

    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{backgroundColor: color, color: textColor}}
        >
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
                        style={{color: textColor}}
                    >
                        Random
                    </button>
                    <button
                        onClick={() => setColor('#ffffff')}
                        className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 border-current/20 hover:border-current/40 cursor-pointer"
                        style={{color: textColor}}
                    >
                        White
                    </button>
                    <button
                        onClick={() => setColor('#000000')}
                        className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 border-current/20 hover:border-current/40 cursor-pointer"
                        style={{color: textColor}}
                    >
                        Black
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
