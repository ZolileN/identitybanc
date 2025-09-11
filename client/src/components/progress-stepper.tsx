import { Link, IdCard, Camera, CheckCircle } from "lucide-react";

interface Step {
  id: string;
  label: string;
  icon: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
}

const iconMap = {
  'link': Link,
  'id-card': IdCard,
  'camera': Camera,
  'check-circle': CheckCircle,
};

export default function ProgressStepper({ steps, currentStep }: ProgressStepperProps) {
  return (
    <div className="mb-8" data-testid="progress-stepper">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border transform -translate-y-1/2"></div>
        
        {steps.map((step, index) => {
          const IconComponent = iconMap[step.icon as keyof typeof iconMap];
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          
          return (
            <div
              key={step.id}
              className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isActive 
                  ? 'verification-step active' 
                  : isCompleted 
                    ? 'verification-step completed'
                    : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`step-indicator-${step.id}`}
            >
              <IconComponent className="h-4 w-4" />
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between mt-3 text-sm">
        {steps.map((step, index) => (
          <span
            key={step.id}
            className={
              index === currentStep 
                ? 'text-primary font-medium' 
                : index < currentStep
                  ? 'text-success font-medium'
                  : 'text-muted-foreground'
            }
            data-testid={`step-label-${step.id}`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
