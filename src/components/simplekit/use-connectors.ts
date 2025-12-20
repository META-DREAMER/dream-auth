"use client";

import * as React from "react";
import { type Connector, useConnect } from "wagmi";
import { SimpleKitContext } from "./simplekit-context";

export function useConnectors() {
  const context = React.useContext(SimpleKitContext);
  const { connect, connectors } = useConnect({
    mutation: {
      onError: () => context.setIsConnectorError(true),
    },
  });

  const sortedConnectors = React.useMemo(() => {
    let metaMaskConnector: Connector | undefined;
    let injectedMetaMaskConnector: Connector | undefined;
    let injectedConnector: Connector | undefined;

    // Fix: Provide initial value for reduce
    const formattedConnectors = connectors.reduce<Array<Connector>>((acc, curr) => {
      switch (curr.id) {
        case "metaMaskSDK":
          metaMaskConnector = {
            ...curr,
            icon: "https://utfs.io/f/be0bd88f-ce87-4cbc-b2e5-c578fa866173-sq4a0b.png",
          };
          return acc;
        case "metaMask":
          injectedMetaMaskConnector = {
            ...curr,
            icon: "https://utfs.io/f/be0bd88f-ce87-4cbc-b2e5-c578fa866173-sq4a0b.png",
          };
          return acc;
        case "baseAccount":
          acc.push({
            ...curr,
            icon: "https://avatars.githubusercontent.com/u/16627100?s=256&v=4",
          });
          return acc;
        case "safe":
          acc.push({
            ...curr,
            icon: "https://utfs.io/f/164ea200-3e15-4a9b-9ce5-a397894c442a-awpd29.png",
          });
          return acc;
        case "injected":
          injectedConnector = {
            ...curr,
          };
          return acc;
        case "walletConnect":
            acc.push({
              ...curr,
              icon: "https://utfs.io/f/5bfaa4d1-b872-48a7-9d37-c2517d4fc07a-utlf4g.png",
            });
          return acc;
        default:
            acc.unshift(curr);
          return acc;
      }
    }, []);
    const numInjectedConnectors = formattedConnectors.filter(({ type }) => type === "injected").length;
    const allConnectors = injectedConnector && numInjectedConnectors <= 1 ? [injectedConnector, ...formattedConnectors] : formattedConnectors;
    if (
      metaMaskConnector &&
      !allConnectors.find(
        ({ id }) =>
          id === "io.metamask" ||
          id === "io.metamask.mobile" ||
          id === "injected",
      )
    ) {
      return [metaMaskConnector, ...allConnectors];
    }

    if (injectedMetaMaskConnector) {
      const nonMetaMaskConnectors = allConnectors.filter(
        ({ id }) => id !== "io.metamask" && id !== "io.metamask.mobile",
      );
      return [injectedMetaMaskConnector, ...nonMetaMaskConnectors];
    }

    return allConnectors;
  }, [connectors]);

  return { connectors: sortedConnectors, connect };
}
