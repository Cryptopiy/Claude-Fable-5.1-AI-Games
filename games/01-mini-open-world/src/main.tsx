import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

// StrictMode is intentionally not used: it double-mounts effects in development, which would
// create and destroy the WebGL game instance twice on the same canvas.
ReactDOM.createRoot(root).render(<App />);
