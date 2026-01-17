
/**
 * Cisco CLI Command Expert
 * Copyright (c) 2026 Firestarter Forge
 * Author: Canti Firestarter <canti@firestartforge.dev>
 * License: MIT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
