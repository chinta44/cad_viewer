import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support, WebAPK installation & Android file handling
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('CADStudio 3D has a new update.');
  },
  onOfflineReady() {
    console.log('CADStudio 3D is ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
