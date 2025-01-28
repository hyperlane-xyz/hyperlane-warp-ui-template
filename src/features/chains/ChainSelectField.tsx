import { ChainSearchMenuProps, ChevronIcon } from '@hyperlane-xyz/widgets';
import { useField, useFormikContext } from 'formik';
import { useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TransferFormValues } from '../transfer/types';
import { ChainSelectListModal } from './ChainSelectModal';
import { useChainDisplayName } from './hooks';

type Props = {
  name: string;
  label: string;
  onChange?: (id: ChainName, fieldName: string) => void;
  disabled?: boolean;
  customListItemField: ChainSearchMenuProps['customListItemField'];
};

export function ChainSelectField({ name, label, onChange, disabled, customListItemField }: Props) {
  const [field, , helpers] = useField<ChainName>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();

  const displayName = useChainDisplayName(field.value, true);

  const handleChange = (chainName: ChainName) => {
    helpers.setValue(chainName);
    // Reset other fields on chain change
    setFieldValue('recipient', '');
    setFieldValue('amount', '');
    if (onChange) onChange(chainName, name);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClick = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <div className="flex-[4]">
      <button
        type="button"
        name={field.name}
        className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className="max-w-[1.4rem] sm:max-w-fit">
            <ChainLogo chainName={field.value} size={32} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <label htmlFor={name} className="text-xs text-gray-600">
              {label}
            </label>
            {displayName}
          </div>
        </div>
        <ChevronIcon width={12} height={8} direction="s" />
      </button>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
        customListItemField={customListItemField}
      />
    </div>
  );
}

const styles = {
  base: 'px-2 py-1.5 w-full flex items-center justify-between text-sm bg-white rounded-lg border border-primary-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-100 active:scale-95 focus:border-primary-500',
  disabled: 'bg-gray-150 cursor-default',
};
