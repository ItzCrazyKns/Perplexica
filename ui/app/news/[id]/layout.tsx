import { Metadata } from "next";
import React from "react";
import { ENV, assertEnvVariables as assertEnvironmentVariables } from "../../../lib/constants";

export const metadata: Metadata = {
  title: "News - Perplexica",
};

assertEnvironmentVariables(ENV);

const Layout = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export default Layout;
