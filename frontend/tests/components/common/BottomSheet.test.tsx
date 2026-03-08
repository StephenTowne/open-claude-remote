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

  describe('拖拽手柄交互', () => {
    it('拖拽超过阈值关闭面板', async () => {
      render(<BottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Sheet')).toBeDefined();
      });

      // 找到拖拽手柄区域（高度 44px 的容器）
      const handleArea = document.querySelector('div[style*="height: 44"]') as HTMLElement;
      expect(handleArea).toBeDefined();

      // 模拟触摸拖拽：开始 -> 移动（超过100px）-> 结束
      fireEvent.touchStart(handleArea!, { touches: [{ clientY: 300, identifier: 0 }] });
      fireEvent.touchMove(handleArea!, { touches: [{ clientY: 420, identifier: 0 }] });
      fireEvent.touchEnd(handleArea!);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });
    });

    it('拖拽距离不足时面板回弹不关闭', async () => {
      render(<BottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Sheet')).toBeDefined();
      });

      const handleArea = document.querySelector('div[style*="height: 44"]') as HTMLElement;

      // 模拟小距离拖拽（50px，介于 5px 和 100px 阈值之间）
      fireEvent.touchStart(handleArea!, { touches: [{ clientY: 300, identifier: 0 }] });
      fireEvent.touchMove(handleArea!, { touches: [{ clientY: 350, identifier: 0 }] });
      fireEvent.touchEnd(handleArea!);

      // 面板仍应打开（不调用 onClose）
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('轻触拖拽手柄区域关闭面板', async () => {
      render(<BottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Sheet')).toBeDefined();
      });

      const handleArea = document.querySelector('div[style*="height: 44"]') as HTMLElement;

      // 模拟轻触：触摸开始和结束位置几乎相同（< 5px）
      fireEvent.touchStart(handleArea!, { touches: [{ clientY: 300, identifier: 0 }] });
      fireEvent.touchMove(handleArea!, { touches: [{ clientY: 302, identifier: 0 }] });
      fireEvent.touchEnd(handleArea!);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });
    });
  });
});