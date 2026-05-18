// Smith — Bootstrap

import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.jsx';
import { AuthProvider } from './lib/AuthContext.jsx';
import { RouterProvider } from './lib/router.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider>
      <AuthProvider>
        <App/>
      </AuthProvider>
    </RouterProvider>
  </React.StrictMode>
);
