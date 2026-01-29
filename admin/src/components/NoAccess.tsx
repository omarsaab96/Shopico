import { useI18n } from "../context/I18nContext";

const NoAccess = () => {
  const { t } = useI18n();

  return (
    <div className="empty-state">
      <div className="empty-title">{t("noPermissionTitle")}</div>
      <div className="muted">{t("noPermissionBody")}</div>
    </div>
  );
};

export default NoAccess;
