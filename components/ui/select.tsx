'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type Option = { value: string; label: string; disabled?: boolean };
type SelectProps = {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

// The portal stays in an enclosing dialog, above its native top-layer backdrop.
export function Select({ id, label, value, onValueChange, options, placeholder,
  name, required, disabled, className = '' }: SelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement>();
  useLayoutEffect(() => {
    setContainer(trigger.current?.closest('dialog') ?? undefined);
  }, []);
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}
      name={name} required={required} disabled={disabled}>
      <SelectPrimitive.Trigger ref={trigger} id={id} aria-label={label}
        className={`custom-select-trigger ${className}`}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown size={14} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content position="popper" sideOffset={5} collisionPadding={12}
          className="custom-select-content">
          <SelectPrimitive.ScrollUpButton className="custom-select-scroll">
            <ChevronUp size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="custom-select-viewport">
            {options.map(option => (
              <SelectPrimitive.Item key={option.value} value={option.value}
                disabled={option.disabled} className="custom-select-item">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator><Check size={14} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="custom-select-scroll">
            <ChevronDown size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
