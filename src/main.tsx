import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import axios from 'axios';
import App from './App.tsx';
import './index.css';

// Generate or retrieve persistent unique Device ID for individual data sandbox
let deviceId = "device_default";
try {
  const stored = localStorage.getItem("trendfinder_device_id");
  if (stored) {
    deviceId = stored;
  } else {
    const generated = "device_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("trendfinder_device_id", generated);
    deviceId = generated;
  }
} catch (e) {
  deviceId = "device_session_" + Math.random().toString(36).substring(2, 15);
}

// Configure axios to always send the x-device-id header
axios.defaults.headers.common["x-device-id"] = deviceId;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
