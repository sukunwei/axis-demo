import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TodoStoreContext } from './stores/TodoStoreContext';
import { todoStore } from './stores/todoStore';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TodoStoreContext.Provider value={todoStore}>
      <App />
    </TodoStoreContext.Provider>
  </React.StrictMode>
);
