import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

export const usePermissions = () => {
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const permissionsSet = useMemo(() => new Set(permissions), [permissions]);

  const can = (permission: string) => permissionsSet.has(permission);
  const canAny = (...permissionList: string[]) => permissionList.some((permission) => permissionsSet.has(permission));

  return { permissions, can, canAny };
};
