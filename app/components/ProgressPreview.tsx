import { computeProgress, fillMessage, formatMoney } from "app/lib/progress";

export interface PreviewSettings {
    threshold: string;
    messageEmpty: string;
    messageProgress: string;
    messageSuccess: string;
    barColor: string;
    trackColor: string;
    backgroundColor: string;
    textColor: string;
    fontSize: number;
    borderRadius: number;
}

const ProgressPreview = ({
    settings: s,
    cartCents,
    currency,
}: {
    settings: PreviewSettings;
    cartCents: number;
    currency: string;
}) => {
    const thresholdCents = Math.round(Number(s.threshold || 0) * 100);
    const { state, remainingCents, percent } = computeProgress(cartCents, thresholdCents);
    const template = state === "empty" ? s.messageEmpty : state === "success" ? s.messageSuccess : s.messageProgress;
    const message = fillMessage(template, {
        amount: formatMoney(remainingCents, currency),
        threshold: formatMoney(thresholdCents, currency),
    });

    return (
        <div
            style={{
                background: s.backgroundColor,
                color: s.textColor,
                fontSize: s.fontSize,
                borderRadius: s.borderRadius,
                padding: "12px 16px",
                textAlign: "center",
            }}
        >
            <div style={{ marginBottom: 8 }}>{message}</div>
            <div
                style={{
                    background: s.trackColor,
                    height: 8,
                    borderRadius: s.borderRadius,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: s.barColor,
                        transition: "width .3s ease",
                    }}
                />
            </div>
        </div>
    )
}

export default ProgressPreview