import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { BotLab } from './ui/BotLab'

// No StrictMode: the game controller owns a requestAnimationFrame loop and
// window-level listeners, and StrictMode's mount/unmount simulation would
// tear them down. The controller is a singleton for the app's lifetime.
//
// #/bot mounts the Bot Lab dev surface *instead of* the app so the game
// controller's global key/rAF listeners never start. Hash changes reload.
const root = createRoot(document.getElementById('root')!)
root.render(window.location.hash === '#/bot' ? <BotLab /> : <App />)
window.addEventListener('hashchange', () => window.location.reload())
