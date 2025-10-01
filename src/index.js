// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoaderProvider } from "./Loader/LoaderProvider";
import { installFetchInterceptor } from "./net";
import "./App.css";

installFetchInterceptor();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <LoaderProvider>
      <App />
    </LoaderProvider>
  </BrowserRouter>
);
