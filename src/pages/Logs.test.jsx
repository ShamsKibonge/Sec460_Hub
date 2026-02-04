import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Logs from './Logs';
import { getLogs } from '../api/logs';
import React from 'react';

// Mock the api
jest.mock('../api/logs');

const mockLogs = {
    logs: [
        {
            id: 1,
            createdAt: '2023-10-27T10:00:00Z',
            actorEmail: 'alice@example.com',
            actorAlias: 'Alice',
            targetEmail: 'bob@example.com',
            targetAlias: 'Bob',
            activityType: 'LOGIN',
            details: {}
        },
        {
            id: 2,
            createdAt: '2023-10-28T10:00:00Z',
            actorEmail: 'charlie@example.com',
            actorAlias: 'Charlie',
            targetEmail: 'alice@example.com',
            targetAlias: 'Alice',
            activityType: 'LOGOUT',
            details: {}
        }
    ]
};

describe('Logs Component', () => {
    beforeEach(() => {
        getLogs.mockReset();
    });

    test('renders logs and filters by date', async () => {
        getLogs.mockResolvedValue(mockLogs);

        const { container } = render(<Logs />);

        // Wait for logs to load
        await waitFor(() => {
            // We expect at least 2 'LOGIN' texts: one in dropdown option, one in table cell
            expect(screen.getAllByText('LOGIN').length).toBeGreaterThan(1);
        });

        const dateInput = container.querySelector('input[type="date"]');

        // Filter by a date that definitely doesn't match
        fireEvent.change(dateInput, { target: { value: '2020-01-01' } });

        await waitFor(() => {
             // Should only find the option in the select, not the table cell
             // The select option is always there.
             const loginElements = screen.queryAllByText('LOGIN');
             expect(loginElements.length).toBe(1);
             expect(loginElements[0].tagName).toBe('OPTION');
        });

        // Check LOGOUT too
        const logoutElements = screen.queryAllByText('LOGOUT');
        expect(logoutElements.length).toBe(1); // Only the option

        // Clear filter
        fireEvent.change(dateInput, { target: { value: '' } });

        await waitFor(() => {
            // Should be back
             expect(screen.getAllByText('LOGIN').length).toBeGreaterThan(1);
        });
    });
});
