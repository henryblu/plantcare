import type { ReactNode } from "react";

export interface StepDefinition<TStep extends string = string> {
  key: TStep;
  title: string;
  description?: ReactNode;
}

export interface StepperProps<TStep extends string = string> {
  steps: StepDefinition<TStep>[];
  currentStep: TStep;
}

const Stepper = <TStep extends string>({ steps, currentStep }: StepperProps<TStep>) => {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <ol className="stepper" aria-label="Add plant progress">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        const itemClass = `stepper__item stepper__item--${state}`;
        const isCurrent = state === "current";
        return (
          <li key={step.key} className={itemClass} aria-current={isCurrent ? "step" : undefined}>
            <div className="stepper__marker" aria-hidden="true">
              {state === "complete" ? <span className="stepper__marker-check">✓</span> : index + 1}
            </div>
            <div className="stepper__body">
              <span className="stepper__title">{step.title}</span>
              {step.description && (
                <span className="stepper__description">{step.description}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default Stepper;
