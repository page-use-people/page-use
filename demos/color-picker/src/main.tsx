import { createRoot } from 'react-dom/client';
import { main } from '@page-use/client';
import './index.css';
import App from './App.tsx';

(window as unknown as Record<string, unknown>).main = main;

createRoot(document.getElementById('root')!).render(<App />);
