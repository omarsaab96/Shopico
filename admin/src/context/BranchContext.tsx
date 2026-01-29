import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Branch } from "../types/api";
import { fetchMyBranches } from "../api/client";
import { useAuth } from "./AuthContext";

interface BranchContextValue {
  branches: Branch[];
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export const BranchProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    localStorage.getItem("branchId")
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setBranches([]);
      setSelectedBranchIdState(null);
      localStorage.removeItem("branchId");
      return;
    }
    const userBranchIds = user.branchIds || [];
    const stored = localStorage.getItem("branchId");
    const initial = stored && userBranchIds.includes(stored) ? stored : userBranchIds[0] || null;
    if (initial) {
      setSelectedBranchIdState(initial);
      localStorage.setItem("branchId", initial);
    }

    setLoading(true);
    fetchMyBranches()
      .then((list) => {
        setBranches(list);
        const allowedIds = list.map((b) => b._id);
        let next = initial;
        if (!next || !allowedIds.includes(next)) {
          next = allowedIds[0] || null;
        }
        setSelectedBranchIdState(next);
        if (next) localStorage.setItem("branchId", next);
        else localStorage.removeItem("branchId");
      })
      .finally(() => setLoading(false));
  }, [user?._id]);

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    localStorage.setItem("branchId", id);
  };

  const selectedBranch = useMemo(
    () => branches.find((b) => b._id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, selectedBranch, setSelectedBranchId, loading }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
};
