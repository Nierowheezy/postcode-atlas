/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { createQueryClient } from './lib/ask/queryClient';
import './index.css';

// One QueryClient for the app: owns the Ask Atlas reply cache, the future
// grounded-lookup caches (features 3+), and the retry defaults.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
