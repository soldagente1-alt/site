import {
  getNfseTitle,
  hasIssuedNfse,
  isFamilyActiveNow,
} from "./eligibility";

describe("FamilyPayments eligibility", () => {
  it("detecta família ativa por status ou activation_status", () => {
    expect(isFamilyActiveNow({ status: "active" })).toBe(true);
    expect(isFamilyActiveNow({ activation_status: "kit_ativo" })).toBe(true);
    expect(isFamilyActiveNow({ status: "pending" })).toBe(false);
  });

  it("detecta NFS-e emitida", () => {
    expect(hasIssuedNfse({ nfse_status: "issued" })).toBe(true);
    expect(hasIssuedNfse({ nfse: { status: "authorized" } })).toBe(true);
    expect(hasIssuedNfse({ nfse_status: "pending" })).toBe(false);
  });

  it("expõe a regra central de recibo/fatura/NF no título da nota", () => {
    expect(getNfseTitle({}, false, false)).toMatch(/somente após ativação/i);
    expect(getNfseTitle({}, true, false)).toMatch(/apenas para parcela paga/i);
    expect(getNfseTitle({ nfse_status: "issued" }, true, true)).toMatch(/emitida/i);
    expect(getNfseTitle({ nfse_status: "processing" }, true, true)).toMatch(/Atualizar emissão/i);
    expect(getNfseTitle({}, true, true)).toMatch(/Emitir NFS-e/i);
  });
});
