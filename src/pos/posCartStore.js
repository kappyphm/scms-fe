import { useSyncExternalStore } from "react";

// Giỏ hàng POS dùng chung cho ba màn hình (POS, tuỳ chỉnh món POP-01,
// thanh toán POP-02) — giữ trong bộ nhớ phiên trang như state của
// prototype, mất khi tải lại trang.
//
// Dòng giỏ: { key, productId, name, categoryName, size, sugar, ice,
//   toppings: [{ toppingId, name, extraPrice }], note, quantity,
//   unitPrice } — unitPrice là giá theo size (chưa gồm topping), khớp
// cách backend tính dòng đơn (unitPrice + toppingTotal) x quantity.
// pendingOrderId: đơn PENDING đã tạo ở backend mà chưa thanh toán xong —
// giữ để màn hình thanh toán/đơn chờ tiếp tục đúng đơn, tránh tạo trùng.
let lines = [];
let voucherCode = "";
let pendingOrderId = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function lineKey(l) {
  return [
    l.productId,
    l.size,
    l.sugar,
    l.ice,
    (l.toppings || []).map((t) => t.toppingId).join(","),
    l.note || "",
  ].join("|");
}

export function lineUnitTotal(l) {
  return (
    Number(l.unitPrice || 0) +
    (l.toppings || []).reduce((s, t) => s + Number(t.extraPrice || 0), 0)
  );
}

export function lineTotal(l) {
  return lineUnitTotal(l) * l.quantity;
}

export function cartSubtotal(ls) {
  return ls.reduce((s, l) => s + lineTotal(l), 0);
}

export function cartCount(ls) {
  return ls.reduce((s, l) => s + l.quantity, 0);
}

export const posCart = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getLines() {
    return lines;
  },
  getVoucher() {
    return voucherCode;
  },
  getPendingOrderId() {
    return pendingOrderId;
  },
  setVoucher(code) {
    voucherCode = code || "";
    emit();
  },
  setPendingOrderId(id) {
    pendingOrderId = id;
    emit();
  },
  addLine(line) {
    const key = lineKey(line);
    const existing = lines.find((l) => l.key === key);
    if (existing) {
      lines = lines.map((l) =>
        l.key === key ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l
      );
    } else {
      lines = [...lines, { ...line, key }];
    }
    emit();
  },
  replaceLine(oldKey, line) {
    lines = lines.filter((l) => l.key !== oldKey);
    const key = lineKey(line);
    const existing = lines.find((l) => l.key === key);
    if (existing) {
      lines = lines.map((l) =>
        l.key === key ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l
      );
    } else {
      lines = [...lines, { ...line, key }];
    }
    emit();
  },
  setQuantity(key, quantity) {
    if (quantity <= 0) {
      lines = lines.filter((l) => l.key !== key);
    } else {
      lines = lines.map((l) => (l.key === key ? { ...l, quantity } : l));
    }
    emit();
  },
  removeLine(key) {
    lines = lines.filter((l) => l.key !== key);
    emit();
  },
  clear() {
    lines = [];
    voucherCode = "";
    pendingOrderId = null;
    emit();
  },
};

export function usePosCart() {
  const ls = useSyncExternalStore(posCart.subscribe, posCart.getLines);
  const vc = useSyncExternalStore(posCart.subscribe, posCart.getVoucher);
  const pending = useSyncExternalStore(posCart.subscribe, posCart.getPendingOrderId);
  return { lines: ls, voucherCode: vc, pendingOrderId: pending };
}
