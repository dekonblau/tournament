import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ManagerProvider } from './store/managerContext';
import { AppInit } from './components/AppInit';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ManagerProvider>
        <AppInit />
        <App />
      </ManagerProvider>
    </BrowserRouter>
  </React.StrictMode>
);
