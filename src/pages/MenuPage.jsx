import { Tab, Tabs } from "react-bootstrap";
import AdminLayout from "../layouts/AdminLayout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SessionHeaderRight from "../components/SessionHeader.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { roleLabel } from "../auth/landing.js";
import { buildMenu } from "../config/menu.js";
import CategoriesTab from "./menu/CategoriesTab.jsx";
import ProductsTab from "./menu/ProductsTab.jsx";
import ToppingsTab from "./menu/ToppingsTab.jsx";

// SCR-11 — Menu chuỗi. TAB-05 gồm Sản phẩm + Danh mục (FE-07/FE-08)
// và Topping dùng chung (FE-09); TAB-06 Công thức thuộc FE-10.
export default function MenuPage() {
  const { user } = useAuth();
  const menu = buildMenu(user);

  return (
    <AdminLayout
      menu={menu}
      branchName={user?.branchName || undefined}
      headerRight={<SessionHeaderRight />}
      userName={user?.fullName}
      userRole={roleLabel(user?.role)}
    >
      <PageHeader
        title="Menu & BOM"
        screenCode="SCR-11 · TAB-05"
        description="Quản trị danh mục, giá bán và công thức chuẩn toàn chuỗi."
      />
      <Tabs defaultActiveKey="products" id="menu-tabs">
        <Tab eventKey="products" title="Sản phẩm & giá">
          <div className="pt-3">
            <ProductsTab />
          </div>
        </Tab>
        <Tab eventKey="categories" title="Danh mục">
          <div className="pt-3">
            <CategoriesTab />
          </div>
        </Tab>
        <Tab eventKey="toppings" title="Topping">
          <div className="pt-3">
            <ToppingsTab />
          </div>
        </Tab>
      </Tabs>
    </AdminLayout>
  );
}
