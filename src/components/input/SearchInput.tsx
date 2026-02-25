import { SearchIcon, XIcon } from '@hyperlane-xyz/widgets';
import { Ref } from 'react';
import { TextInput } from './TextField';

export function SearchInput({
  inputRef,
  value,
  onChange,
  placeholder,
}: {
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full">
      <SearchIcon
        width={16}
        height={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        name="search"
        className="!mt-0 w-full pl-9 pr-8 all:border-gray-300 all:py-2 all:text-sm all:focus:border-blue-400"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
        >
          <XIcon width={12} height={12} />
        </button>
      )}
    </div>
  );
}
