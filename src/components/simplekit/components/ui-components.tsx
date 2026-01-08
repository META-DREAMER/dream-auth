"use client";

import {
	ArrowCounterClockwiseIcon,
	CaretLeftIcon,
	CheckIcon,
	CopyIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import { useAccount, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { SimpleKitContext } from "../simplekit-context";

export function CopyAddressButton() {
	const { address } = useAccount();
	const [copied, setCopied] = React.useState(false);

	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (copied) setCopied(false);
		}, 1000);
		return () => clearTimeout(timeout);
	}, [copied]);

	async function handleCopy() {
		if (!address) return;
		setCopied(true);
		await navigator.clipboard.writeText(address);
	}

	return (
		<button
			type="button"
			className="text-muted-foreground"
			onClick={handleCopy}
		>
			{copied ? (
				<CheckIcon className="size-4" weight="fill" />
			) : (
				<CopyIcon className="size-4" weight="fill" />
			)}
			<span className="sr-only">{copied ? "Copied" : "Copy address"}</span>
		</button>
	);
}

export function BackChevron() {
	const context = React.useContext(SimpleKitContext);

	if (!context.pendingConnector) {
		return null;
	}

	function handleClick() {
		context.setIsConnectorError(false);
		context.setPendingConnector(null);
	}

	return (
		<button
			type="button"
			className="absolute left-[26px] top-[42px] z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground md:top-[26px]"
			onClick={handleClick}
		>
			<CaretLeftIcon className="h-4 w-4" />
			<span className="sr-only">Cancel connection</span>
		</button>
	);
}

export function RetryConnectorButton() {
	const context = React.useContext(SimpleKitContext);
	const { connect } = useConnect({
		mutation: {
			onError: () => context.setIsConnectorError(true),
		},
	});

	function handleClick() {
		if (context.pendingConnector) {
			context.setIsConnectorError(false);
			connect({ connector: context.pendingConnector });
		}
	}

	return (
		<Button
			size="icon"
			variant="secondary"
			className="group absolute -bottom-2 -right-2 rounded-full bg-muted p-1.5 shadow"
			onClick={handleClick}
		>
			<ArrowCounterClockwiseIcon className="size-4 transition-transform group-hover:-rotate-45" />
		</Button>
	);
}
