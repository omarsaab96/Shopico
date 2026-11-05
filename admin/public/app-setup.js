(() => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const setupToken = params.get("setupToken") || "";
  const arabic = navigator.language?.startsWith("ar");
  const words = arabic ? {
    title: "إعداد حسابك",
    intro: "افتح تطبيق شوبيكو لتعيين كلمة المرور.",
    open: "افتح شوبيكو",
    copy: "نسخ رمز الإعداد",
    help: "إذا لم يفتح التطبيق، ثبت شوبيكو أو حدثه ثم حاول مجدداً. يمكنك أيضاً نسخ رمز الإعداد ولصقه في التطبيق بعد إدخال بريدك.",
    invalid: "رابط الإعداد غير مكتمل أو غير صالح. اطلب الرابط الكامل من المتجر.",
    copied: "تم النسخ. ألصق الرمز في شاشة إعداد كلمة المرور في شوبيكو.",
    copyFailed: "تعذر النسخ. افتح هذه الصفحة في متصفح هاتفك وحاول مجدداً."
  } : {
    title: "Set up your account", intro: "Open the Shopico app to choose your password.",
    open: "Open Shopico", copy: "Copy setup code",
    help: "If the app does not open, install or update Shopico, then tap Open Shopico again. You can also copy the setup code and paste it into the app after entering your email.",
    invalid: "This setup link is incomplete or invalid. Ask the store for the full invitation link.",
    copied: "Copied. Paste the code into Shopico's password setup screen.",
    copyFailed: "Could not copy. Open this page in your phone's browser and try again."
  };
  const element = id => document.getElementById(id);
  document.documentElement.lang = arabic ? "ar" : "en";
  document.documentElement.dir = arabic ? "rtl" : "ltr";
  document.title = `${words.title} | Shopico`;
  for (const [id, key] of [["title", "title"], ["intro", "intro"], ["open-app", "open"], ["copy-code", "copy"], ["help", "help"]]) {
    element(id).textContent = words[key];
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-f0-9]{64}$/i.test(setupToken)) {
    element("status").textContent = words.invalid;
    return;
  }
  element("account").textContent = email;
  const query = new URLSearchParams({ email, setupToken }).toString();
  const appUrl = `shopico://auth/login?${query}`;
  // A user-tapped intent anchor lets Android Chrome launch the installed app.
  const fallback = new URL(window.location.href);
  fallback.hash = "app-not-opened";
  element("open-app").href = /Android/i.test(navigator.userAgent)
    ? `intent://auth/login?${query}#Intent;scheme=shopico;package=com.omarsaab96.shopico;S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end`
    : appUrl;
  element("actions").hidden = false;
  element("copy-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(setupToken);
      element("status").textContent = words.copied;
    } catch {
      element("status").textContent = words.copyFailed;
    }
  });
})();
