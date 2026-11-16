import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { KeyboardSafeForm } from '../../ui/KeyboardSafeForm';
import { useSemanticForm } from './useSemanticForm';
import { SemanticFormProps, FormFieldMetadata } from './types';

export const SemanticForm: React.FC<SemanticFormProps> = ({
  targetType,
  client,
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
}) => {
  const { schema, values, errors, isSubmitting, isLoadingSchema, setFieldValue, handleSubmit } =
    useSemanticForm(client, targetType, initialData);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);

  if (isLoadingSchema) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading form schema...</Text>
      </View>
    );
  }

  if (!schema) {
    return (
      <View style={styles.centered}>
        <Text>Error: Failed to load form schema for {targetType}</Text>
      </View>
    );
  }

  const renderField = (field: FormFieldMetadata) => {
    const isBoolean = field.range === 'http://www.w3.org/2001/XMLSchema#boolean';
    const isNumeric =
      field.range === 'http://www.w3.org/2001/XMLSchema#integer' ||
      field.range === 'http://www.w3.org/2001/XMLSchema#double';

    return (
      <View key={field.predicate} style={styles.fieldContainer}>
        <Text style={styles.label}>
          {field.label} {field.required && <Text style={styles.required}>*</Text>}
        </Text>
        {field.description && <Text style={styles.description}>{field.description}</Text>}

        {isBoolean ? (
          <Switch
            value={!!values[field.predicate]}
            onValueChange={(val) => setFieldValue(field.predicate, val)}
          />
        ) : (
          <TextInput
            style={[
              styles.input,
              focusedField === field.predicate ? styles.inputFocused : null,
              errors[field.predicate] ? styles.inputError : null,
            ]}
            value={values[field.predicate]?.toString() || ''}
            onChangeText={(text) => {
              if (isNumeric) {
                const isDouble = field.range === 'http://www.w3.org/2001/XMLSchema#double';
                const filter = isDouble 
                  ? /^[+-]?\d*\.?\d*(?:[eE][+-]?\d*)?$/
                  : /^[+-]?\d*$/;
                if (filter.test(text)) {
                  setFieldValue(field.predicate, text);
                }
              } else {
                setFieldValue(field.predicate, text);
              }
            }}
            onFocus={() => setFocusedField(field.predicate)}
            onBlur={() => setFocusedField(null)}
            keyboardType={isNumeric ? 'numeric' : 'default'}
            placeholder={field.label}
          />
        )}

        {errors[field.predicate] && <Text style={styles.errorText}>{errors[field.predicate]}</Text>}
      </View>
    );
  };

  return (
    <KeyboardSafeForm
      style={styles.keyboardAvoidingView}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Form for {schema.targetType.split(/[/|#]/).pop()}</Text>
        {schema.fields.map(renderField)}

        <View style={styles.buttonContainer}>
          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isSubmitting ? 'Submitting' : submitLabel}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : submitLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardSafeForm>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  required: {
    color: 'red',
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: 'red',
  },
  inputFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
    padding: 7,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  button: {
    marginLeft: 8,
  },
  cancelButton: {
    marginLeft: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    marginLeft: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
