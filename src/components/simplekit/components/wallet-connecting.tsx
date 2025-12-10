"use client";

import * as React from "react";
import { SimpleKitContext } from "../simplekit-context";
import { RetryConnectorButton } from "./ui-components";

export function WalletConnecting() {
  const context = React.useContext(SimpleKitContext);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-9 md:pt-5">
      {context.pendingConnector?.icon && (
        <div className="size-[116px] relative flex items-center justify-center rounded-2xl border p-3">
          <img
            src={context.pendingConnector?.icon}
            alt={context.pendingConnector?.name}
            className="size-full overflow-hidden rounded-2xl"
          />
          {/* Empty img tag removed as it was likely a placeholder or mistake in original code */}
          {context.isConnectorError ? <RetryConnectorButton /> : null}
        </div>
      )}
      <div className="space-y-3.5 px-3.5 text-center sm:px-0">
        <h1 className="text-xl font-semibold">
          {context.isConnectorError ? "Request Error" : "Requesting Connection"}
        </h1>
        <p className="text-balance text-sm text-muted-foreground">
          {context.isConnectorError
            ? "There was an error with the request. Click above to try again."
            : `Open the ${context.pendingConnector?.name} browser extension to connect your wallet.`}
        </p>
      </div>
    </div>
  );
}
