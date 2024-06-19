import { useIsAccountChainalysisSanctioned } from './useIsAccountChainalysisSanctioned';
import { useIsAccountOfacSanctioned } from './useIsAccountOfacSanctioned';

export function useIsAccountSanctioned() {
  const isAccountOfacSanctioned = useIsAccountOfacSanctioned();
  const isAccountChainalysisSanctioned = useIsAccountChainalysisSanctioned();

  return isAccountOfacSanctioned || isAccountChainalysisSanctioned;
}
