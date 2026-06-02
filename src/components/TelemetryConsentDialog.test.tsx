import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TelemetryConsentDialog } from "./TelemetryConsentDialog";

describe("TelemetryConsentDialog", () => {
	it("renders the title", () => {
		render(<TelemetryConsentDialog onEnable={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.getByText("Help improve Zosma Cowork")).toBeInTheDocument();
	});

	it("renders both action buttons", () => {
		render(<TelemetryConsentDialog onEnable={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.getByText("Not now")).toBeInTheDocument();
		expect(screen.getByText("Enable telemetry")).toBeInTheDocument();
	});

	it("calls onEnable when Enable telemetry is clicked", async () => {
		const onEnable = vi.fn();
		render(<TelemetryConsentDialog onEnable={onEnable} onDismiss={vi.fn()} />);
		await userEvent.click(screen.getByText("Enable telemetry"));
		expect(onEnable).toHaveBeenCalledOnce();
	});

	it("calls onDismiss when Not now is clicked", async () => {
		const onDismiss = vi.fn();
		render(<TelemetryConsentDialog onEnable={vi.fn()} onDismiss={onDismiss} />);
		await userEvent.click(screen.getByText("Not now"));
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("shows privacy bullet points", () => {
		render(<TelemetryConsentDialog onEnable={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.getByText(/No personal data collected/i)).toBeInTheDocument();
		expect(screen.getByText(/No user IDs or cookies/i)).toBeInTheDocument();
	});

	it("shows footer note about settings", () => {
		render(<TelemetryConsentDialog onEnable={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.getByText(/You can change this anytime in Settings/i)).toBeInTheDocument();
	});
});
