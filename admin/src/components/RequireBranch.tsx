import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useBranch } from "../context/BranchContext";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

const RequireBranch = ({ children }: { children: ReactElement }) => {
  const { branches, selectedBranchId, loading } = useBranch();
  const { t } = useI18n();
  const { canAny } = usePermissions();
  const canManageBranches = canAny("branches:view", "branches:manage");

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
        <div className="loaderText">{t("loading")}</div>
      </div>
    );
  }

  if (branches.length === 0 || !selectedBranchId) {
    return (
      <div className="empty-state branch-required">
        <div className="empty-title">{t("branchesRequiredTitle")}</div>
        <p className="muted">{t("branchesRequiredBody")}</p>
        {canManageBranches ? (
          <Link className="primary branch-required-cta" to="/branches">
            {t("manageBranches")}
          </Link>
        ) : (
          <div className="muted">{t("branchesRequiredNoAccess")}</div>
        )}
      </div>
    );
  }

  return children;
};

export default RequireBranch;
