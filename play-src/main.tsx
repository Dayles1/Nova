import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NovaWing } from "@/components/nova-wing";
import "./styles.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <NovaWing />
  </StrictMode>,
);
