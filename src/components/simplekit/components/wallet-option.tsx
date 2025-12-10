"use client";

import * as React from "react";
import { type Connector } from "wagmi";
import { Button } from "@/components/ui/button";

export function WalletOption(props: { connector: Connector; onClick: () => void }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    async function checkReady() {
      const provider = await props.connector.getProvider();
      setReady(!!provider);
    }

    checkReady()
      .then(() => null)
      .catch(() => null);
  }, [props.connector]);

  return (
    <Button
      disabled={!ready}
      onClick={props.onClick}
      size="lg"
      variant="secondary"
      className="justify-between rounded-xl px-4 py-7 text-base font-semibold"
    >
      <p>{props.connector.name}</p>
      {props.connector.icon && (
        <img
          src={props.connector.icon}
          alt={props.connector.name}
          className="size-8 overflow-hidden rounded-[6px]"
        />
      )}
    </Button>
  );
}
