import { computeNextDueDate } from "./computeNextDueDate";

describe("computeNextDueDate", () => {
  it("retorna null para dia inválido", () => {
    expect(computeNextDueDate(0)).toBeNull();
    expect(computeNextDueDate(29)).toBeNull();
    expect(computeNextDueDate("abc")).toBeNull();
  });

  it("mantém o mês quando o vencimento ainda não passou", () => {
    const d = computeNextDueDate(20, new Date(2026, 2, 10, 9, 0, 0));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(20);
  });

  it("vai para o mês seguinte quando o vencimento já passou", () => {
    const d = computeNextDueDate(5, new Date(2026, 2, 10, 9, 0, 0));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(5);
  });
});
