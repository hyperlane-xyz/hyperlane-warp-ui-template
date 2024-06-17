import { useIsAccountChainalysisSanctioned } from './useIsAccountChainalysisSanctioned';
import { useIsAccountOfacSanctioned } from './useIsAccountOfacSanctioned';

export const useIsAccountSanctioned = () => {
  const isAccountOfacSanctioned = useIsAccountOfacSanctioned();
  const isAccountChainalysisSanctioned = useIsAccountChainalysisSanctioned();

  return isAccountOfacSanctioned || isAccountChainalysisSanctioned;
};
