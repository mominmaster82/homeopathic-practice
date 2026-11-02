import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

// নতুন ডিপ্লয় এলে সার্ভিস ওয়ার্কার আপডেট হয়ে পেজ নিজেই রিলোড হবে,
// নইলে পুরোনো ক্যাশ করা JS চলতে থাকে।
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
