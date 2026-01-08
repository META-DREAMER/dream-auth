export function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatDateLong(date: Date | string) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function formatAddress(address: string | null | undefined) {
	if (!address) return "";
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
