import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ERPProvider } from './context/ERPContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { router } from './app/router.tsx';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ERPProvider>
        <RouterProvider router={router} />
      </ERPProvider>
    </LanguageProvider>
  );
};

export default App;
