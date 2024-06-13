import { useChainalysisSanctioned } from './useChainalysisSanctioned';
import { useOfacSanctioned } from './useOfacSanctioned';

export const useSanctioned = () => {
  const ofacSanctioned = useOfacSanctioned();
  const chainalysisSanctioned = useChainalysisSanctioned();

  return ofacSanctioned || chainalysisSanctioned;
};
