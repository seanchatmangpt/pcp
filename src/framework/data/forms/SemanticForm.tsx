import React from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Switch } from 'react-native';
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
            style={[styles.input, errors[field.predicate] ? styles.inputError : null]}
            value={values[field.predicate]?.toString() || ''}
            onChangeText={(text) => {
              let val: any = text;
              if (isNumeric) {
                val = text.includes('.') ? parseFloat(text) : parseInt(text, 10);
                if (isNaN(val)) val = text;
              }
              setFieldValue(field.predicate, val);
            }}
            keyboardType={isNumeric ? 'numeric' : 'default'}
            placeholder={field.label}
          />
        )}

        {errors[field.predicate] && <Text style={styles.errorText}>{errors[field.predicate]}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Form for {schema.targetType.split(/[/|#]/).pop()}</Text>
      {schema.fields.map(renderField)}

      <View style={styles.buttonContainer}>
        {onCancel && (
          <View style={styles.button}>
            <Button title={cancelLabel} onPress={onCancel} color="#666" />
          </View>
        )}
        <View style={styles.button}>
          <Button
            title={isSubmitting ? 'Submitting...' : submitLabel}
            onPress={() => handleSubmit(onSubmit)}
            disabled={isSubmitting}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
