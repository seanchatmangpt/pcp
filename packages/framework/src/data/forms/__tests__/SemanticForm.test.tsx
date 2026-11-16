import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SemanticForm } from '../SemanticForm';
import { useSemanticForm } from '../useSemanticForm';
import { A11yAuditor } from '../../../validation/A11yAuditor';

jest.mock('../useSemanticForm');

describe('SemanticForm', () => {
  const mockSubmit = jest.fn();
  const mockCancel = jest.fn();

  const mockUseSemanticForm = {
    schema: {
      targetType: 'https://schema.org/Person',
      fields: [
        {
          predicate: 'https://schema.org/name',
          label: 'Name',
          required: true,
          range: 'http://www.w3.org/2001/XMLSchema#string',
        },
        {
          predicate: 'https://schema.org/isEmployee',
          label: 'Is Employee',
          required: false,
          range: 'http://www.w3.org/2001/XMLSchema#boolean',
        },
      ],
    },
    values: {},
    errors: {},
    isSubmitting: false,
    isLoadingSchema: false,
    setFieldValue: jest.fn(),
    handleSubmit: jest.fn((cb) => cb({ 'https://schema.org/name': 'Test' })),
    validate: jest.fn(() => true),
  };

  beforeEach(() => {
    (useSemanticForm as jest.Mock).mockReturnValue(mockUseSemanticForm);
  });

  it('renders loading state', () => {
    (useSemanticForm as jest.Mock).mockReturnValue({
      ...mockUseSemanticForm,
      isLoadingSchema: true,
      schema: null,
    });

    const { getByText } = render(
      <SemanticForm targetType="https://schema.org/Person" onSubmit={mockSubmit} />
    );
    expect(getByText('Loading form schema...')).toBeTruthy();
  });

  it('renders error state if schema fails', () => {
    (useSemanticForm as jest.Mock).mockReturnValue({
      ...mockUseSemanticForm,
      isLoadingSchema: false,
      schema: null,
    });

    const { getByText } = render(
      <SemanticForm targetType="https://schema.org/Person" onSubmit={mockSubmit} />
    );
    expect(getByText(/Error: Failed to load form schema/)).toBeTruthy();
  });

  it('renders form fields and handles input', () => {
    const { getByLabelText, getByText, getByPlaceholderText } = render(
      <SemanticForm targetType="https://schema.org/Person" onSubmit={mockSubmit} />
    );

    expect(getByText('Form for Person')).toBeTruthy();
    expect(getByText(/Name/)).toBeTruthy();
    expect(getByText(/Is Employee/)).toBeTruthy();

    const nameInput = getByPlaceholderText('Name');
    fireEvent.changeText(nameInput, 'Jane Doe');
    expect(mockUseSemanticForm.setFieldValue).toHaveBeenCalledWith(
      'https://schema.org/name',
      'Jane Doe'
    );
  });

  it('passes accessibility audit', () => {
    const { UNSAFE_root } = render(
      <SemanticForm
        targetType="https://schema.org/Person"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    );
    expect(() => A11yAuditor.auditTree(UNSAFE_root)).not.toThrow();
  });
});
