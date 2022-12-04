import { ChangeEvent } from 'react';
import styles from 'src/components/buttons/SwitchButton.module.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SwitchButton({ checked, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    onChange(target.checked);
  };

  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} onChange={handleChange} />
      <span className={`${styles.slider} ${styles.round}`}></span>
    </label>
  );
}
