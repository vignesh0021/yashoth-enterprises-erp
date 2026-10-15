import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ERPProvider } from './context/ERPContext.tsx';
import { router } from './app/router.tsx';

export const App: React.FC = () => {
  return (
    <ERPProvider>
      <RouterProvider router={router} />
    </ERPProvider>
  );
};

export default App;
