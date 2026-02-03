import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { DeviceEventEmitter } from "react-native";

interface ServerStatusContextType {
  isServiceUnavailable: boolean;
  setServiceUnavailable: (status: boolean) => void;
  checkStatus: () => void;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(
  undefined
);

export const SERVER_STATUS_EVENT = "SERVER_STATUS_CHANGE";

export const ServerStatusProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isServiceUnavailable, setServiceUnavailable] = useState(false);

  // Function to manually re-check status (can be triggered by Retry button)
  const checkStatus = useCallback(() => {
    // Optimistically assume it's back, subsequent requests will fail again if not
    setServiceUnavailable(false);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      SERVER_STATUS_EVENT,
      (status: { isUnavailable: boolean }) => {
        setServiceUnavailable(status.isUnavailable);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ServerStatusContext.Provider
      value={{ isServiceUnavailable, setServiceUnavailable, checkStatus }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
};

export const useServerStatus = () => {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error(
      "useServerStatus must be used within a ServerStatusProvider"
    );
  }
  return context;
};
