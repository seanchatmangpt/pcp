import { Term } from '../../vkg/rdf';

export interface FormFieldMetadata {
  predicate: string;
  label: string;
  description?: string;
  required: boolean;
  range: string; // The expected type (e.g., xsd:string, or a class URI)
  order?: number;
}

export interface SemanticFormSchema {
  targetType: string;
  fields: FormFieldMetadata[];
}

export interface SemanticFormProps {
  targetType: string;
  client?: any;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

export interface SemanticFormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  schema: SemanticFormSchema | null;
  isLoadingSchema: boolean;
}
