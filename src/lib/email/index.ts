export { sendEmail } from "@/lib/email/send";
export {
	orgInvitationEmail,
	otpEmail,
	verificationEmail,
	walletInvitationEmail,
} from "@/lib/email/templates";
export type {
	EmailTemplate,
	SendEmailInput,
	SendEmailResult,
} from "@/lib/email/types";
