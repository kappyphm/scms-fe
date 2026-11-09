import { useSyncExternalStore } from "react";

// Phiên thu ngân của MÁY POS (FE-34): khi không có phiên đăng nhập
// web, POS mở bằng mã PIN thu ngân (gắn với check-in chấm công).
// Phiên lưu ở sessionStorage — đóng tab là khóa máy. Chi nhánh của
// máy được thiết lập một lần ở localStorage, giống máy kiosk.
const SESSION_KEY = "scms.posCashier";
const BRANCH_KEY = "scms.posBranchId";

function hydrate() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let current = hydrate();
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export const posCashier = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get() {
    return current;
  },
  set(session) {
    current = session;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* sessionStorage không khả dụng — phiên chỉ sống trong tab */
    }
    emit();
  },
  clear() {
    current = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* bỏ qua */
    }
    emit();
  },
  getTerminalBranch() {
    const v = localStorage.getItem(BRANCH_KEY);
    return v ? Number(v) : null;
  },
  setTerminalBranch(id) {
    localStorage.setItem(BRANCH_KEY, String(id));
  },
  clearTerminalBranch() {
    localStorage.removeItem(BRANCH_KEY);
  },
};

export function usePosCashier() {
  return useSyncExternalStore(posCashier.subscribe, posCashier.get);
}
