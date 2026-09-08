import { useState, useRef, useEffect, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string) => void;
  debounceMs?: number;
}

export default function SearchInput({
  onChange,
  debounceMs = 300,
  className,
  placeholder = 'Buscar...',
  ...props
}: SearchInputProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange?.(value), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, onChange]);

  return (
    <div className={cn('relative', className)}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search size={18} className="text-[#9CA3AF]" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white',
          'placeholder:text-[#9CA3AF] pl-10 pr-3 py-2.5 text-sm',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]',
        )}
        {...props}
      />
    </div>
  );
}
