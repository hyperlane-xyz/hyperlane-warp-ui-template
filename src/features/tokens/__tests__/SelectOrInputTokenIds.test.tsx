import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectOrInputTokenIds } from '../SelectOrInputTokenIds';

vi.mock('../../../components/input/TextField', () => ({
  TextField: (props: any) => <input data-testid="text-field" {...props} />,
}));

vi.mock('../SelectTokenIdField', () => ({
  SelectTokenIdField: (props: any) => <select data-testid="select-token-id-field" {...props} />,
}));

vi.mock('formik', async () => {
  const actual = await vi.importActual<any>('formik');
  return {
    ...actual,
    useFormikContext: () => ({
      values: { tokenIndex: 0 },
    }),
  };
});

describe('SelectOrInputTokenIds', () => {
  // Add your tests here
  it('should render select when force input false', () => {
    const screen = render(<SelectOrInputTokenIds disabled={false} forceInput={false} />);
    expect(screen.getByTestId('select-token-id-field')).toBeInTheDocument();
  });
  it('should render input when force input true', () => {
    const screen = render(<SelectOrInputTokenIds disabled={false} forceInput={true} />);
    expect(screen.getByTestId('text-field')).toBeInTheDocument();
  });
});
