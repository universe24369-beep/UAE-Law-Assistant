import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ClerkProvider } from '@clerk/clerk-react';
import { ClerkAuthBridge, StaticAuthBridge } from './contexts/AuthBridge';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey}>
        <ClerkAuthBridge>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </ClerkAuthBridge>
      </ClerkProvider>
    ) : (
      <StaticAuthBridge>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </StaticAuthBridge>
    )}
  </StrictMode>,
);
