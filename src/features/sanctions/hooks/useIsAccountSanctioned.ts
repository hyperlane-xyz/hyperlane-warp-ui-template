import { useIsAccountChainalysisSanctioned } from './useIsAccountChainalysisSanctioned';
import { useIsAccountOfacSanctioned } from './useIsAccountOfacSanctioned';

export function useIsAccountSanctioned(enabled = true) {
  const isAccountOfacSanctioned = useIsAccountOfacSanctioned(enabled);
  const isAccountChainalysisSanctioned = useIsAccountChainalysisSanctioned(enabled);

  return isAccountOfacSanctioned || isAccountChainalysisSanctioned;
}
