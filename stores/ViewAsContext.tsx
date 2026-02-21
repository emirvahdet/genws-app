import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ViewAsUser {
  id: string;
  full_name: string;
  email: string;
}

interface ViewAsContextType {
  viewAsUser: ViewAsUser | null;
  isViewingAs: boolean;
  startViewAs: (user: ViewAsUser) => void;
  stopViewAs: () => void;
  getEffectiveUserId: (realUserId: string) => string;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAsUser: null,
  isViewingAs: false,
  startViewAs: () => {},
  stopViewAs: () => {},
  getEffectiveUserId: (id) => id,
});

export const useViewAs = () => useContext(ViewAsContext);

export const ViewAsProvider = ({ children }: { children: ReactNode }) => {
  const [viewAsUser, setViewAsUser] = useState<ViewAsUser | null>(null);

  const startViewAs = useCallback((user: ViewAsUser) => {
    setViewAsUser(user);
  }, []);

  const stopViewAs = useCallback(() => {
    setViewAsUser(null);
  }, []);

  const getEffectiveUserId = useCallback(
    (realUserId: string) => {
      return viewAsUser ? viewAsUser.id : realUserId;
    },
    [viewAsUser]
  );

  return (
    <ViewAsContext.Provider
      value={{
        viewAsUser,
        isViewingAs: !!viewAsUser,
        startViewAs,
        stopViewAs,
        getEffectiveUserId,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  );
};
