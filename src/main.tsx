import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

// No StrictMode: the game controller owns a requestAnimationFrame loop and
// window-level listeners, and StrictMode's mount/unmount simulation would
// tear them down. The controller is a singleton for the app's lifetime.
createRoot(document.getElementById('root')!).render(<App />)
