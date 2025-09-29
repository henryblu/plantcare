/**
 * @vitest-environment jsdom
 */

import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

describe('App render', () => {
  it('renders without crashing', () => {
    render(<App />);
  });
});
