import { Metadata } from "next";
import React from "react";
import { ENV, assertEnvVariables } from "../../../lib/constants";

export const metadata: Metadata = {
  title: "News - Perplexica",
};

assertEnvVariables(ENV);

const Layout = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export default Layout;
