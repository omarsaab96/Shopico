import type { ReactElement } from "react";
import { usePermissions } from "../hooks/usePermissions";
import NoAccess from "./NoAccess";

const RequirePermission = ({ anyOf, children }: { anyOf: string[]; children: ReactElement }) => {
  const { canAny } = usePermissions();
  if (!canAny(...anyOf)) return <NoAccess />;
  return children;
};

export default RequirePermission;
