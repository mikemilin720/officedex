import { Input } from "antd";
import type { InputProps, PasswordProps, TextAreaProps } from "antd/es/input";
import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type TextareaHTMLAttributes } from "react";

type InputElement = HTMLInputElement | HTMLTextAreaElement;
type ImeValueProps = {
  value?: string;
  onValueChange?: (value: string) => void;
};

function valueToString(value: unknown): string {
  return value == null ? "" : String(value);
}

function useImeValue<E extends InputElement>({
  value,
  onChange,
  onValueChange,
}: {
  value?: string;
  onChange?: (event: ChangeEvent<E>) => void;
  onValueChange?: (value: string) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => valueToString(value));
  const composingRef = useRef(false);
  const lastCompositionCommitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!composingRef.current) {
      setDraftValue(valueToString(value));
    }
  }, [value]);

  function emitChange(event: ChangeEvent<E>) {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  }

  function handleChange(event: ChangeEvent<E>) {
    const nextValue = event.currentTarget.value;
    setDraftValue(nextValue);
    if (composingRef.current) return;
    if (lastCompositionCommitRef.current === nextValue) {
      lastCompositionCommitRef.current = null;
      return;
    }
    emitChange(event);
  }

  function handleCompositionStart(event: CompositionEvent<E>, original?: (event: CompositionEvent<E>) => void) {
    composingRef.current = true;
    lastCompositionCommitRef.current = null;
    setDraftValue(event.currentTarget.value);
    original?.(event);
  }

  function handleCompositionEnd(event: CompositionEvent<E>, original?: (event: CompositionEvent<E>) => void) {
    const nextValue = event.currentTarget.value;
    composingRef.current = false;
    lastCompositionCommitRef.current = nextValue;
    setDraftValue(nextValue);
    original?.(event);
    onValueChange?.(nextValue);
    if (onChange) {
      onChange(event as unknown as ChangeEvent<E>);
    }
  }

  return {
    draftValue,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
  };
}

export type ImeInputProps = Omit<InputProps, "value"> & ImeValueProps;

export function ImeInput({ value, onChange, onValueChange, onCompositionStart, onCompositionEnd, ...props }: ImeInputProps) {
  const ime = useImeValue<HTMLInputElement>({ value, onChange, onValueChange });
  return (
    <Input
      {...props}
      value={ime.draftValue}
      onChange={ime.handleChange}
      onCompositionStart={(event) => ime.handleCompositionStart(event, onCompositionStart)}
      onCompositionEnd={(event) => ime.handleCompositionEnd(event, onCompositionEnd)}
    />
  );
}

export type ImePasswordInputProps = Omit<PasswordProps, "value"> & ImeValueProps;

export function ImePasswordInput({ value, onChange, onValueChange, onCompositionStart, onCompositionEnd, ...props }: ImePasswordInputProps) {
  const ime = useImeValue<HTMLInputElement>({ value, onChange, onValueChange });
  return (
    <Input.Password
      {...props}
      value={ime.draftValue}
      onChange={ime.handleChange}
      onCompositionStart={(event) => ime.handleCompositionStart(event, onCompositionStart)}
      onCompositionEnd={(event) => ime.handleCompositionEnd(event, onCompositionEnd)}
    />
  );
}

export type ImeTextAreaProps = Omit<TextAreaProps, "value"> & ImeValueProps;

export function ImeTextArea({ value, onChange, onValueChange, onCompositionStart, onCompositionEnd, ...props }: ImeTextAreaProps) {
  const ime = useImeValue<HTMLTextAreaElement>({ value, onChange, onValueChange });
  return (
    <Input.TextArea
      {...props}
      value={ime.draftValue}
      onChange={ime.handleChange}
      onCompositionStart={(event) => ime.handleCompositionStart(event, onCompositionStart)}
      onCompositionEnd={(event) => ime.handleCompositionEnd(event, onCompositionEnd)}
    />
  );
}

export type ImePlainTextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & ImeValueProps;

export function ImePlainTextArea({ value, onChange, onValueChange, onCompositionStart, onCompositionEnd, className, ...props }: ImePlainTextAreaProps) {
  const ime = useImeValue<HTMLTextAreaElement>({ value, onChange, onValueChange });
  const mergedClassName = ["ant-input", className].filter(Boolean).join(" ");
  return (
    <textarea
      {...props}
      className={mergedClassName}
      value={ime.draftValue}
      onChange={ime.handleChange}
      onCompositionStart={(event) => ime.handleCompositionStart(event, onCompositionStart)}
      onCompositionEnd={(event) => ime.handleCompositionEnd(event, onCompositionEnd)}
    />
  );
}
