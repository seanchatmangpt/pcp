import React from 'react';
import { useExperiment } from './useExperiment';

interface VariantProps {
  /**
   * The name of the variant this component should be rendered for.
   */
  name: string;
  children: React.ReactNode;
}

/**
 * A container for a specific experiment variant.
 * Must be used as a direct child of the Experiment component.
 */
export const Variant: React.FC<VariantProps> = ({ children }) => {
  return <>{children}</>;
};

interface ExperimentProps {
  /**
   * The unique identifier for the experiment.
   */
  id: string;
  children: React.ReactNode;
}

/**
 * Declaratively renders children based on the assigned experiment variant.
 * Matches children of type Variant with the corresponding name.
 *
 * @example
 * <Experiment id="cta-color">
 *   <Variant name="A"><Button color="blue" /></Variant>
 *   <Variant name="B"><Button color="green" /></Variant>
 * </Experiment>
 */
export const Experiment: React.FC<ExperimentProps> = ({ id, children }) => {
  const { variant } = useExperiment(id);

  const matchedVariants = React.Children.toArray(children).filter((child) => {
    if (React.isValidElement(child) && child.type === Variant) {
      return (child as React.ReactElement<{ name: string }>).props.name === variant;
    }
    return false;
  });

  return <>{matchedVariants}</>;
};
