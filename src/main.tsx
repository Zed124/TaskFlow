import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import i18n, { applyDocumentLanguage } from "./i18n";
import { App } from "./app/app";
import { installReleaseGuards } from "./app/release-guards";
import { applyThemeHint } from "./features/settings/appearance";

applyThemeHint();
applyDocumentLanguage(i18n.language);
installReleaseGuards();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
