import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoPicker } from './PhotoPicker';
import { NO_PHOTO_CHANGE, type PhotoChange } from './Uploadapi';

function Harness({ currentUrl, onChange }: { currentUrl?: string; onChange: (value: PhotoChange) => void }) {
  const [value, setValue] = useState(NO_PHOTO_CHANGE);
  return (
    <PhotoPicker
      name="Rahul Sharma"
      purpose="joiner_photo"
      currentUrl={currentUrl}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('PhotoPicker', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('rejects files that are not small images', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.upload(
      screen.getByLabelText('Photo'),
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Use a JPG, PNG or WEBP image');
    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Photo'), huge);
    expect(screen.getByRole('alert')).toHaveTextContent('the limit is 5 MB');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('previews a picked photo and marks a saved one as removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Harness currentUrl="https://files.test/saved.jpg" onChange={onChange} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://files.test/saved.jpg');
    await user.upload(screen.getByLabelText('Photo'), new File(['img'], 'new.png', { type: 'image/png' }));
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:preview');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenLastCalledWith({ file: null, removed: true });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('RS')).toBeInTheDocument();
  });
});
