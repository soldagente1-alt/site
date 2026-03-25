import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function DynamicPaymentDocumentPreview({ docData }) {
  const layout = docData?.layout;
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function buildQr() {
      if (!docData?.qrPayload) return setQrUrl("");
      try {
        const url = await QRCode.toDataURL(docData.qrPayload, { margin: 1, width: 260 });
        if (!cancelled) setQrUrl(url);
      } catch (e) {
        console.error(e);
        if (!cancelled) setQrUrl("");
      }
    }

    buildQr();
    return () => {
      cancelled = true;
    };
  }, [docData?.qrPayload]);

  if (!docData?.template?.png?.download_url) {
    return (
      <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-600">
        O PNG do template ainda não foi enviado pelo admin.
      </div>
    );
  }

  if (!layout?.canvas || !layout?.fields) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border bg-amber-50 px-4 py-3 text-sm text-amber-900">
          O layout dinâmico ainda não foi configurado. Mostrando apenas a arte base.
        </div>
        <img src={docData.template.png.download_url} alt={docData.title} className="w-full h-auto rounded-lg" />
      </div>
    );
  }

  const toPct = (value, total) => `${(Number(value || 0) / Number(total || 1)) * 100}%`;

  function boxStyle(box) {
    return {
      position: "absolute",
      left: toPct(box.x, layout.canvas.width),
      top: toPct(box.y, layout.canvas.height),
      width: toPct(box.w, layout.canvas.width),
      height: toPct(box.h, layout.canvas.height),
    };
  }

  function textField(box, value, options = {}) {
    if (!box || !value) return null;
    const {
      align = "left",
      size = 14,
      weight = 700,
      wrap = false,
      mono = false,
      color = "#5A3A2A",
    } = options;

    return (
      <div
        style={{
          ...boxStyle(box),
          display: "flex",
          alignItems: wrap ? "flex-start" : "center",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          color,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "Georgia, serif",
          fontWeight: weight,
          fontSize: size,
          lineHeight: wrap ? 1.35 : 1.1,
          whiteSpace: wrap ? "pre-wrap" : "nowrap",
          overflow: "hidden",
          paddingTop: wrap ? 2 : 0,
        }}
      >
        {value}
      </div>
    );
  }

  const items = docData?.items || [];
  const itemsArea = layout?.fields?.itemsArea;

  return (
    <div className="w-full">
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 980,
          margin: "0 auto",
          aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}`,
          backgroundImage: `url(${docData.template.png.download_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          overflow: "hidden",
          borderRadius: 20,
        }}
      >
        {textField(layout.fields?.number, docData.number, { size: 14 })}
        {textField(layout.fields?.issueDate, docData.issueDate, { size: 14 })}
        {textField(layout.fields?.status, docData.status, { size: 14 })}
        {textField(layout.fields?.dueDate, docData.dueDate, { size: 13 })}
        {textField(layout.fields?.competence, docData.competence, { size: 14 })}
        {textField(layout.fields?.customerName, docData.customerName, { size: 15 })}
        {textField(layout.fields?.customerCpf, docData.customerCpf, { size: 14 })}
        {textField(layout.fields?.familyGroup, docData.familyGroup, { size: 13 })}
        {textField(layout.fields?.declarationLine1, docData.declarationLine1, { size: 12 })}
        {textField(layout.fields?.declarationLine2, docData.declarationLine2, { size: 12 })}
        {textField(layout.fields?.declarationLine3, docData.declarationLine3, { size: 12 })}
        {textField(layout.fields?.verificationCode, docData.verificationCode, { size: 12 })}
        {textField(layout.fields?.pixKey, docData.pixKey, { size: 11 })}
        {textField(layout.fields?.pixBeneficiary, docData.pixBeneficiary, { size: 11 })}
        {textField(layout.fields?.pixCopyPaste, docData.pixCopyPaste, {
          size: 10,
          wrap: true,
          mono: true,
          weight: 600,
        })}
        {textField(layout.fields?.boletoLine, docData.boletoLine, {
          size: 10,
          wrap: true,
          mono: true,
          weight: 700,
        })}
        {textField(layout.fields?.observationLine1, docData.observationLine1, { size: 11 })}
        {textField(layout.fields?.observationLine2, docData.observationLine2, { size: 11 })}
        {textField(layout.fields?.observationLine3, docData.observationLine3, { size: 11 })}

        {itemsArea ? (
          <div
            style={{
              ...boxStyle(itemsArea),
              color: "#5A3A2A",
              fontFamily: "Georgia, serif",
              fontSize: 11,
              display: "grid",
              alignContent: "start",
              gap: 14,
              paddingTop: 2,
            }}
          >
            {items.map((item, index) => (
              <div
                key={`${item.description}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 120px",
                  gap: 12,
                  alignItems: "center",
                  minHeight: 42,
                }}
              >
                <div>{item.description}</div>
                <div style={{ textAlign: "right" }}>{item.qty}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {layout.fields?.qrArea && qrUrl ? (
          <div
            style={{
              ...boxStyle(layout.fields.qrArea),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src={qrUrl} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : null}

        {layout.fields?.barcodeArea ? (
          <div
            style={{
              ...boxStyle(layout.fields.barcodeArea),
              background:
                "repeating-linear-gradient(90deg, rgba(69,49,35,0.95) 0 2px, transparent 2px 4px, rgba(69,49,35,0.95) 4px 5px, transparent 5px 8px)",
              opacity: docData?.boletoLine ? 0.9 : 0.15,
              borderRadius: 8,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
