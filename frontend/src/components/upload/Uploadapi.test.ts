import { describe, expect, it } from 'vitest';
import { mimeTypeOf } from './Uploadapi';

describe('mimeTypeOf', () => {
  it('trusts the extension over the browser type', () => {
    expect(mimeTypeOf(new File(['a,b'], 'pending.csv', { type: 'application/vnd.ms-excel' }))).toBe('text/csv');
    expect(mimeTypeOf(new File(['x'], 'Responses.XLSX'))).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mimeTypeOf(new File(['x'], 'scan.png', { type: 'image/png' }))).toBe('image/png');
    expect(mimeTypeOf(new File(['x'], 'unknown'))).toBe('application/octet-stream');
  });
});
