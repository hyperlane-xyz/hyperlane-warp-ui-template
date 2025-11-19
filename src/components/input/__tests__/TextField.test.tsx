import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import { describe, expect, it, vi } from 'vitest';
import { TextField, TextInput } from '../TextField';

describe('TextField', () => {
  it('should render Formik Field', () => {
    render(
      <Formik initialValues={{ testField: '' }} onSubmit={() => {}}>
        <Form>
          <TextField name="testField" />
        </Form>
      </Formik>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should apply default className', () => {
    const { container } = render(
      <Formik initialValues={{ testField: '' }} onSubmit={() => {}}>
        <Form>
          <TextField name="testField" />
        </Form>
      </Formik>,
    );
    const input = container.querySelector('.mt-1\\.5');
    expect(input).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Formik initialValues={{ testField: '' }} onSubmit={() => {}}>
        <Form>
          <TextField name="testField" className="custom-class" />
        </Form>
      </Formik>,
    );
    const input = container.querySelector('.custom-class');
    expect(input).toBeInTheDocument();
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(
      <Formik initialValues={{ testField: '' }} onSubmit={onSubmit}>
        <Form>
          <TextField name="testField" />
        </Form>
      </Formik>,
    );
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test value');
    expect(input).toHaveValue('test value');
  });
});

describe('TextInput', () => {
  it('should render input element', () => {
    const onChange = vi.fn();
    render(<TextInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should call onChange with value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(<TextInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    await user.type(input, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('should have text type', () => {
    const onChange = vi.fn();
    render(<TextInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('should have autocomplete off', () => {
    const onChange = vi.fn();
    render(<TextInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('should apply default className', () => {
    const onChange = vi.fn();
    const { container } = render(<TextInput onChange={onChange} />);
    const input = container.querySelector('.mt-1\\.5');
    expect(input).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const onChange = vi.fn();
    const { container } = render(<TextInput onChange={onChange} className="custom-input" />);
    const input = container.querySelector('.custom-input');
    expect(input).toBeInTheDocument();
  });

  it('should handle empty value changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(<TextInput onChange={onChange} value="test" />);
    const input = screen.getByRole('textbox');
    
    await user.clear(input);
    expect(onChange).toHaveBeenCalled();
  });

  it('should forward ref correctly', () => {
    const onChange = vi.fn();
    const ref = vi.fn();
    
    render(<TextInput ref={ref} onChange={onChange} />);
    expect(ref).toHaveBeenCalled();
  });

  it('should pass through additional props', () => {
    const onChange = vi.fn();
    render(<TextInput onChange={onChange} placeholder="Enter text" disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter text');
    expect(input).toBeDisabled();
  });
});

