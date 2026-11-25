import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import { logger } from "@/utils/logger";

interface NetworkStatus {
  /** null until the platform answers for the first time */
  isInternetReachable: boolean | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  const applyNetworkState = useCallback((state: NetInfoState) => {
    setIsInternetReachable(state.isInternetReachable ?? false);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyNetworkState);
    NetInfo.fetch()
      .then(applyNetworkState)
      .catch((error) => {
        logger.error("network", "Failed to fetch network status", error);
        setIsInternetReachable(false);
      });
    return () => unsubscribe();
  }, [applyNetworkState]);

  return { isInternetReachable };
}
