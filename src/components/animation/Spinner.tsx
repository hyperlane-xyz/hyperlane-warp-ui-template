import { memo } from 'react';

import styles from './Spinner.module.css';

// From https://loading.io/css/
function _Spinner({ white, classes }: { white?: boolean; classes?: string }) {
  return (
    <div className={`${styles.spinner} ${white && styles.white} ${classes || ''}`}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
}

export const Spinner = memo(_Spinner);
