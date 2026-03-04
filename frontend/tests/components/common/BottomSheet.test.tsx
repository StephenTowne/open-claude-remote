import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BottomSheet } from '../../../src/components/common/BottomSheet';

describe('BottomSheet', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    title: 'Test Sheet',
    children: <div>Test Content</div>,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<BottomSheet {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Test Sheet')).toBeNull();
  });

  it('should render when isOpen is true', async () => {
    render(<BottomSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should have drag handle', async () => {
    render(<BottomSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    // 拖拽手柄是一个内部有宽度为 36px 的 div
    const handle = document.querySelector('div[style*="width: 36"]');
    expect(handle).toBeDefined();
  });

  it('should call onClose when close button is clicked', async () => {
    render(<BottomSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', async () => {
    const { container } = render(<BottomSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    // 点击外层遮罩（包含 position: fixed 的 div）
    // 第一个 position: fixed 的 div 是遮罩层
    const overlay = container.querySelector('div[style*="position: fixed"]') as HTMLElement;
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when content is clicked', async () => {
    render(<BottomSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Test Content'));

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should render footer when provided', async () => {
    render(
      <BottomSheet
        {...defaultProps}
        footer={<button>Footer Button</button>}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Sheet')).toBeDefined();
    });

    expect(screen.getByText('Footer Button')).toBeDefined();
  });
});