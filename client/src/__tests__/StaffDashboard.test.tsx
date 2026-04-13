import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { StaffDashboard } from '@/pages/staff/StaffDashboard';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    listCases: vi.fn(),
  },
}));

const mockCases = [
  {
    id: 'case-1',
    status: 'pending',
    chapter: '7',
    clientFirstName: 'John',
    clientLastName: 'Doe',
    caseNumber: null,
    filedAt: null,
    createdAt: '2024-01-15T10:00:00Z',
    progress: { docs: '2/3', sections: '15/27' },
    attention: { count: 3, hasErrors: true },
  },
  {
    id: 'case-2',
    status: 'filed',
    chapter: '13',
    clientFirstName: 'Jane',
    clientLastName: 'Smith',
    caseNumber: '24-12345',
    filedAt: '2024-01-20T14:30:00Z',
    createdAt: '2024-01-10T09:15:00Z',
    progress: { docs: '5/5', sections: '27/27' },
    attention: { count: 0, hasErrors: false },
  },
  {
    id: 'case-3',
    status: 'preparing',
    chapter: '7',
    clientFirstName: 'Alice',
    clientLastName: 'Johnson',
    caseNumber: null,
    filedAt: null,
    createdAt: '2024-01-18T16:45:00Z',
    progress: { docs: '1/2', sections: '8/27' },
    attention: { count: 1, hasErrors: false },
  },
];

function renderStaffDashboard() {
  return render(
    <MemoryRouter>
      <StaffDashboard />
    </MemoryRouter>
  );
}

describe('StaffDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listCases).mockResolvedValue(mockCases);
  });

  it('should render dashboard with case list', async () => {
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('should load cases with progress and attention expand parameters', async () => {
    renderStaffDashboard();

    await waitFor(() => {
      expect(api.listCases).toHaveBeenCalledWith(undefined, ['progress', 'attention']);
    });
  });

  it('should display case information correctly', async () => {
    renderStaffDashboard();

    await waitFor(() => {
      // Check client names
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      
      // Check chapters
      expect(screen.getAllByText('7')).toHaveLength(2); // Two Chapter 7 cases
      expect(screen.getByText('13')).toBeInTheDocument();
      
      // Check statuses
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('filed')).toBeInTheDocument();
      expect(screen.getByText('preparing')).toBeInTheDocument();
      
      // Check progress information
      expect(screen.getByText('2/3')).toBeInTheDocument(); // docs progress
      expect(screen.getByText('15/27')).toBeInTheDocument(); // sections progress
      
      // Check attention counts
      expect(screen.getByText('3')).toBeInTheDocument(); // attention count for case-1
    });
  });

  it('should filter cases by status', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click on the filter dropdown/buttons (assuming button-based filters)
    const filedFilter = screen.getByText('filed');
    await user.click(filedFilter);

    // Should only show filed cases
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  it('should search cases by client name', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search/i });
    await user.type(searchInput, 'Jane');

    // Should only show Jane Smith
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    });
  });

  it('should search cases with partial name matches', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search/i });
    await user.type(searchInput, 'Jo'); // Partial match

    // Should show both John and Johnson (Alice)
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('should clear search when input is emptied', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search/i });
    
    // Search for specific name
    await user.type(searchInput, 'Jane');
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    // Clear search
    await user.clear(searchInput);
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('should sort cases by client name ascending', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click on client name column header to sort
    const clientHeader = screen.getByRole('button', { name: /client|name/i });
    await user.click(clientHeader);

    // Check that cases are sorted alphabetically by name
    const rows = screen.getAllByRole('row');
    // First row should be headers, so data starts from second row
    expect(rows[1]).toHaveTextContent('Alice Johnson');
    expect(rows[2]).toHaveTextContent('Jane Smith');
    expect(rows[3]).toHaveTextContent('John Doe');
  });

  it('should sort cases by client name descending after second click', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const clientHeader = screen.getByRole('button', { name: /client|name/i });
    
    // First click - ascending
    await user.click(clientHeader);
    // Second click - descending
    await user.click(clientHeader);

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('John Doe');
    expect(rows[2]).toHaveTextContent('Jane Smith');
    expect(rows[3]).toHaveTextContent('Alice Johnson');
  });

  it('should sort cases by filing date', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const filingDateHeader = screen.getByRole('button', { name: /filing date|filed/i });
    await user.click(filingDateHeader);

    // Filed cases should come first (have filing dates), pending/preparing cases last (no filing date)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Jane Smith'); // Filed case should be first
  });

  it('should sort cases by creation date', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const createdHeader = screen.getByRole('button', { name: /created/i });
    await user.click(createdHeader);

    // Should sort by creation date (newest first is typical)
    const rows = screen.getAllByRole('row');
    // Alice Johnson created on 2024-01-18 should be first (most recent)
    expect(rows[1]).toHaveTextContent('Alice Johnson');
  });

  it('should sort cases by attention count', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const attentionHeader = screen.getByRole('button', { name: /attention/i });
    await user.click(attentionHeader);

    // Should sort by attention count (highest first to see urgent items)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('John Doe'); // Has attention count of 3
  });

  it('should display attention items with error indicators', async () => {
    renderStaffDashboard();

    await waitFor(() => {
      // Case with errors should show error indicator
      const johnDoeRow = screen.getByText('John Doe').closest('tr');
      expect(johnDoeRow).toHaveTextContent('3'); // attention count
      // Should have error styling or icon (depends on implementation)
    });
  });

  it('should combine filtering and sorting', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Filter by pending status
    const pendingFilter = screen.getByText('pending');
    await user.click(pendingFilter);

    // Should only show John Doe (pending case)
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();

    // Now sort by client name
    const clientHeader = screen.getByRole('button', { name: /client|name/i });
    await user.click(clientHeader);

    // Should still only show filtered results, but sorted
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('should combine search and filtering', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Search for "J" 
    const searchInput = screen.getByRole('textbox', { name: /search/i });
    await user.type(searchInput, 'J');

    // Should show John Doe, Jane Smith, Alice Johnson
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Now filter by status "filed"
    const filedFilter = screen.getByText('filed');
    await user.click(filedFilter);

    // Should only show Jane Smith (matches "J" search and "filed" status)
    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    });
  });

  it('should handle empty search results', async () => {
    const user = userEvent.setup();
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search/i });
    await user.type(searchInput, 'NonexistentName');

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    });

    // Should show empty state or no results message
    expect(screen.getByText(/no cases found|empty/i)).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(api.listCases).mockRejectedValue(new Error('Network error'));
    
    renderStaffDashboard();

    // Should handle the error without crashing
    // The component should either show an error message or empty state
    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  it('should show loading state while fetching cases', () => {
    // Make API call hang to test loading state
    vi.mocked(api.listCases).mockImplementation(() => new Promise(() => {}));
    
    renderStaffDashboard();

    // Should show loading indicator or skeleton
    expect(screen.getByText(/loading/i) || screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should link to individual case pages', async () => {
    renderStaffDashboard();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Case rows or names should be links to case detail pages
    const johnDoeLink = screen.getByRole('link', { name: /john doe/i });
    expect(johnDoeLink).toHaveAttribute('href', expect.stringContaining('/case/case-1'));
  });
});