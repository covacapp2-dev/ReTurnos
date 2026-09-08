import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { QueryProvider } from './contexts/QueryProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <QueryProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #374151',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#1f2937',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#1f2937',
                },
              },
            }}
          />
        </QueryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
