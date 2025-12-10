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
    let injectedConnector: Connector | undefined;

    // Fix: Provide initial value for reduce
    const formattedConnectors = connectors.reduce<Array<Connector>>((acc, curr) => {
      // console.log(curr.id);
      switch (curr.id) {
        case "metaMaskSDK":
          metaMaskConnector = {
            ...curr,
            icon: "https://utfs.io/f/be0bd88f-ce87-4cbc-b2e5-c578fa866173-sq4a0b.png",
          };
          return acc;
        case "metaMask":
          injectedConnector = {
            ...curr,
            icon: "https://utfs.io/f/be0bd88f-ce87-4cbc-b2e5-c578fa866173-sq4a0b.png",
          };
          return acc;
        case "safe":
          acc.push({
            ...curr,
            icon: "https://utfs.io/f/164ea200-3e15-4a9b-9ce5-a397894c442a-awpd29.png",
          });
          return acc;
        case "coinbaseWalletSDK":
          acc.push({
            ...curr,
            icon: "https://utfs.io/f/53e47f86-5f12-404f-a98b-19dc7b760333-chngxw.png",
          });
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

    if (
      metaMaskConnector &&
      !formattedConnectors.find(
        ({ id }) =>
          id === "io.metamask" ||
          id === "io.metamask.mobile" ||
          id === "injected",
      )
    ) {
      return [metaMaskConnector, ...formattedConnectors];
    }

    if (injectedConnector) {
      const nonMetaMaskConnectors = formattedConnectors.filter(
        ({ id }) => id !== "io.metamask" && id !== "io.metamask.mobile",
      );
      return [injectedConnector, ...nonMetaMaskConnectors];
    }

    return formattedConnectors;
  }, [connectors]);

  return { connectors: sortedConnectors, connect };
}
