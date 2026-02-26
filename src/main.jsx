// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

import App from "./App.jsx";
import { msalConfig } from "./authConfig"; // <-- match your project (you already import loginRequest from this file)

const pca = new PublicClientApplication(msalConfig);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MsalProvider instance={pca}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MsalProvider>
  </React.StrictMode>
);